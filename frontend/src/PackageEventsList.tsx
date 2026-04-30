/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { isAdmin, isStaff, useAuth } from './AuthContext';
import { fetchData } from './api';
import ReviewsModal, { type ReviewRecord } from './ReviewsModal';
import { validatePaymentForm as validatePaymentFormFields, type PaymentForm } from './paymentValidation';
import DatePicker from 'react-date-picker';
import 'react-date-picker/dist/DatePicker.css';
import 'react-calendar/dist/Calendar.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const MIDNIGHT_NEXT_DAY = '__MIDNIGHT_NEXT_DAY__';

type Shift = 'Morning' | 'Day' | 'Night';

type ShiftWindow = {
  start: number;
  end: number;
};

const SHIFT_WINDOWS: Record<Shift, ShiftWindow> = {
  Morning: { start: 360, end: 720 },
  Day: { start: 720, end: 1080 },
  Night: { start: 1080, end: 1440 },
};

type Props = {
  showManagement?: boolean;
  onlyJoined?: boolean;
  cruiseId?: string;
};

type ItemRequirement = {
  resource_id: string;
  quantity_required: string;
};

type EventFormState = {
  name: string;
  description: string;
  capacity: string;
  start_date: Date | null;
  start_time: string;
  end_date: Date | null;
  end_time: string;
  staff_ids: string[];
  item_requirements: ItemRequirement[];
};

const emptyForm: EventFormState = {
  name: '',
  description: '',
  capacity: '',
  start_date: new Date(),
  start_time: '',
  end_date: new Date(),
  end_time: '',
  staff_ids: [''],
  item_requirements: [{ resource_id: '', quantity_required: '' }],
};

function toTimeValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function toShift(value: string): Shift | null {
  if (value === 'Morning' || value === 'Day' || value === 'Night') {
    return value;
  }
  return null;
}

function toClockValue(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isNextLocalMidnight(start: Date, end: Date) {
  const expected = new Date(start);
  expected.setDate(expected.getDate() + 1);
  expected.setHours(0, 0, 0, 0);
  return end.getTime() === expected.getTime();
}

function roundUpToNextThirtyMinutes(d: Date) {
  const rounded = new Date(d);
  rounded.setSeconds(0, 0);
  const remainder = rounded.getMinutes() % 30;
  if (remainder !== 0) {
    rounded.setMinutes(rounded.getMinutes() + (30 - remainder));
  }
  return rounded;
}

function getEffectiveShiftWindow(shifts: Shift[]): ShiftWindow | null {
  if (shifts.length === 0) {
    return null;
  }

  const windows = shifts.map((shift) => SHIFT_WINDOWS[shift]);
  const start = Math.max(...windows.map((w) => w.start));
  const end = Math.min(...windows.map((w) => w.end));

  if (start >= end) {
    return null;
  }

  return { start, end };
}

function formatTimeLabel(timeStr: string) {
  if (timeStr === MIDNIGHT_NEXT_DAY) {
    return '12:00 AM (Next day)';
  }

  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
}

function combineDateAndTime(date: Date, timeStr: string) {
  if (timeStr === MIDNIGHT_NEXT_DAY) {
    const result = new Date(date);
    result.setDate(result.getDate() + 1);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function toReadableDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

export default function PackageEventsList({ showManagement = false, onlyJoined = false, cruiseId }: Props) {
  const { user } = useAuth();

  const [events, setEvents] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [editFormState, setEditFormState] = useState<EventFormState>(emptyForm);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelEventId, setCancelEventId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [pendingJoinEventId, setPendingJoinEventId] = useState<number | null>(null);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState('');
  const [reviewsTitle, setReviewsTitle] = useState('Event reviews');
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    cardHolderName: '',
    cardNumber: '',
    expirationDate: '',
    securityCode: '',
    zipCode: '',
  });

  const editCreatorShift = useMemo(() => {
    if (!selectedEvent?.created_by) return null;
    const creator = staffMembers.find((staff) => Number(staff.id) === Number(selectedEvent.created_by));
    return creator ? toShift(creator.shift) : null;
  }, [selectedEvent?.created_by, staffMembers]);

  const editSelectedStaffShifts = useMemo(() => {
    const chosenIds = editFormState.staff_ids
      .filter((value) => value !== '')
      .map((value) => Number(value));

    return chosenIds
      .map((id) => staffMembers.find((staff) => Number(staff.id) === id))
      .map((staff) => toShift(staff?.shift))
      .filter((shift): shift is Shift => shift !== null);
  }, [editFormState.staff_ids, staffMembers]);

  const editActiveWindow = useMemo(() => {
    if (!editCreatorShift) return null;
    return getEffectiveShiftWindow([editCreatorShift, ...editSelectedStaffShifts]);
  }, [editCreatorShift, editSelectedStaffShifts]);

  const editScheduleConstraintError = useMemo(() => {
    if (editingEventId === null) return '';
    if (!editCreatorShift) return 'We could not find the event creator shift details.';

    if (editFormState.staff_ids.some((id) => id !== '') && !editActiveWindow) {
      return 'Selected staff do not share an overlapping shift window for this event.';
    }

    return '';
  }, [editActiveWindow, editCreatorShift, editFormState.staff_ids, editingEventId]);

  const editStartTimeOptions = useMemo(() => {
    if (editingEventId === null || !editFormState.start_date || !editActiveWindow) return [];

    const nowRounded = roundUpToNextThirtyMinutes(new Date());
    const minMinutes = isSameLocalDay(editFormState.start_date, nowRounded)
      ? Math.max(editActiveWindow.start, nowRounded.getHours() * 60 + nowRounded.getMinutes())
      : editActiveWindow.start;

    const options: string[] = [];
    for (let minute = minMinutes; minute < editActiveWindow.end; minute += 30) {
      options.push(toClockValue(minute));
    }

    return options;
  }, [editActiveWindow, editFormState.start_date, editingEventId]);

  const editEndTimeOptions = useMemo(() => {
    if (editingEventId === null || !editActiveWindow || !editFormState.start_time) return [] as string[];

    const [startHours, startMinutes] = editFormState.start_time.split(':').map(Number);
    const selectedStartMinutes = startHours * 60 + startMinutes;

    const options: string[] = [];

    const sameDayMax = Math.min(editActiveWindow.end, 1410);
    for (let minute = selectedStartMinutes + 30; minute <= sameDayMax; minute += 30) {
      options.push(toClockValue(minute));
    }

    if (editActiveWindow.end === 1440 && selectedStartMinutes < 1440) {
      options.push(MIDNIGHT_NEXT_DAY);
    }

    return options;
  }, [editActiveWindow, editFormState.start_time, editingEventId]);

  const canManageEvent = (event: any) => {
    if (!showManagement || !user) return false;
    if (isAdmin(user)) return true;
    return isStaff(user) && Number(event.created_by) === Number(user.userId);
  };

  const validateCancellationReason = (value: string) => {
    const reason = value.trim();
    if (reason.length < 10) {
      return 'Please enter at least 10 characters for the cancellation reason.';
    }

    if (reason.length > 500) {
      return 'Cancellation reason must be 500 characters or less.';
    }

    const safeTextPattern = /^[A-Za-z0-9 ,.!?'"()\-:\n\r]+$/;
    if (!safeTextPattern.test(reason)) {
      return 'Use plain text only (letters, numbers, spaces, and common punctuation).';
    }

    return null;
  };

  const loadEvents = async () => {
    setLoading(true);
    setError('');
    try {
      const endpoint = onlyJoined
        ? '/api/packages/my-events'
        : cruiseId
          ? `/api/packages/events?cruise_id=${encodeURIComponent(cruiseId)}`
          : '/api/packages/events';
      const data = await fetchData(endpoint);
      const allEvents = Array.isArray(data) ? data : [];

      if (onlyJoined) {
        const now = new Date();
        const currentAndFuture = allEvents.filter((event: any) => {
          if (String(event?.status ?? '').toLowerCase() === 'cancelled') {
            return false;
          }

          const end = new Date(event.end_time);
          if (Number.isNaN(end.getTime())) {
            return false;
          }

          return end >= now;
        });

        setEvents(currentAndFuture);
      } else {
        setEvents(allEvents);
      }
    } catch (err) {
      console.error(err);
      setError(onlyJoined ? 'Unable to load your package events right now. Please try again.' : 'Unable to load package events right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadEditFormData = async () => {
    if (!showManagement || !user || (user.role !== 'staff' && user.role !== 'admin')) return;

    try {
      const [resourcesData, staffData] = await Promise.all([
        fetchData('/api/resources'),
        fetchData('/api/staff'),
      ]);

      setResources(Array.isArray(resourcesData) ? resourcesData : []);
      setStaffMembers(Array.isArray(staffData) ? staffData : []);
    } catch (err) {
      console.error(err);
      setError('Unable to load resources and staff for event editing. Please try again.');
    }
  };

  useEffect(() => {
    loadEvents();
    loadEditFormData();
  }, [cruiseId, onlyJoined]);

  useEffect(() => {
    const refreshOnUpdate = () => {
      loadEvents();
    };

    window.addEventListener('package-events-updated', refreshOnUpdate);
    return () => {
      window.removeEventListener('package-events-updated', refreshOnUpdate);
    };
  }, []);

  useEffect(() => {
    if (!showDetailModal) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowDetailModal(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showDetailModal]);

  const openEventDetail = async (eventId: number) => {
    setError('');
    try {
      const detail = await fetchData(`/api/packages/events/${eventId}`);
      setEditingEventId(null);
      setEditFormState(emptyForm);
      setSelectedEvent(detail);
      setShowDetailModal(true);
    } catch (err) {
      console.error(err);
      setError('Unable to load event details right now. Please try again.');
    }
  };

  const openEventReviews = async (eventId: number, eventName: string) => {
    setReviewsOpen(true);
    setReviewsLoading(true);
    setReviewsError('');
    setReviewsTitle(`Reviews for ${eventName}`);

    try {
      const data = await fetchData(`/api/ratings/events/${eventId}`);
      setReviews(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setReviews([]);
      setReviewsError('Unable to load event reviews right now.');
    } finally {
      setReviewsLoading(false);
    }
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      cardHolderName: '',
      cardNumber: '',
      expirationDate: '',
      securityCode: '',
      zipCode: '',
    });
  };

  const closePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setPaymentError('');
    setPendingJoinEventId(null);
    resetPaymentForm();
  };

  const beginPaymentForEvent = (eventId: number) => {
    setError('');
    setPaymentError('');
    setPendingJoinEventId(eventId);
    resetPaymentForm();
    setIsPaymentModalOpen(true);
  };

  type JoinResult = { success: boolean; message?: string };

  const handleJoinEvent = async (eventId: number): Promise<JoinResult> => {
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/packages/events/${eventId}/join`, {
        method: 'POST',
        credentials: 'include',
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const message = body?.error || 'Could not join this event right now.';
        console.error('Backend error:', body);
        setError(message);
        return { success: false, message };
      }

      await loadEvents();
      return { success: true };
    } catch (err: any) {
      console.error(err);
      const message = err?.message || 'Could not join this event right now.';
      setError(message);
      return { success: false, message };
    }
  };

  const handlePaymentSubmit = async () => {

    if (pendingJoinEventId === null) {
      setPaymentError('Please choose an event to reserve first.');
      return;
    }

    const validationError = validatePaymentFormFields(paymentForm);
    if (validationError) {
      setPaymentError(validationError);
      return;
    }

    const result = await handleJoinEvent(pendingJoinEventId);
    if (result.success) {
      setSuccess('Reservation submitted successfully.');
      await openEventDetail(pendingJoinEventId);
      return;
    }

    setPaymentError(result.message ?? 'Unable to complete the reservation. Please try again.');
  };

  const handleLeaveEvent = async (eventId: number) => {
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/packages/events/${eventId}/leave`, {
        method: 'POST',
        credentials: 'include',
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || 'Could not cancel this reservation right now.');
      }

      await loadEvents();
      if (onlyJoined) {
        setShowDetailModal(false);
        setSelectedEvent(null);
      } else {
        await openEventDetail(eventId);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Could not cancel this reservation right now.');
    }
  };

  const beginEditEvent = async (eventId: number) => {
    setError('');
    try {
      const detail = await fetchData(`/api/packages/events/${eventId}`);

      setSelectedEvent(detail);
      setShowDetailModal(true);

      setEditingEventId(eventId);
      setEditFormState({
        name: detail.name ?? '',
        description: detail.description ?? '',
        capacity: String(detail.capacity ?? ''),
        start_date: detail.start_time ? new Date(detail.start_time) : new Date(),
        start_time: toTimeValue(detail.start_time),
        end_date: detail.end_time ? new Date(detail.end_time) : new Date(),
        end_time: (() => {
          const start = detail.start_time ? new Date(detail.start_time) : null;
          const end = detail.end_time ? new Date(detail.end_time) : null;
          if (start && end && isNextLocalMidnight(start, end)) {
            return MIDNIGHT_NEXT_DAY;
          }
          return toTimeValue(detail.end_time);
        })(),
        staff_ids: detail.staff?.length ? detail.staff.map((staff: any) => String(staff.id)) : [''],
        item_requirements: detail.items?.length
          ? detail.items.map((item: any) => ({
            resource_id: String(item.resource_id),
            quantity_required: String(item.quantity_required),
          }))
          : [{ resource_id: '', quantity_required: '' }],
      });
    } catch (err) {
      console.error(err);
      setError('Unable to load this event for editing. Please try again.');
    }
  };

  useEffect(() => {
    if (editingEventId === null) return;

    if (editFormState.start_time && !editStartTimeOptions.includes(editFormState.start_time)) {
      setEditFormState((prev) => ({ ...prev, start_time: '', end_time: '' }));
      return;
    }

    if (editFormState.end_time && !editEndTimeOptions.includes(editFormState.end_time)) {
      setEditFormState((prev) => ({ ...prev, end_time: '' }));
    }
  }, [editEndTimeOptions, editFormState.end_time, editFormState.start_time, editStartTimeOptions, editingEventId]);

  const openCancelModal = (eventId: number) => {
    setCancelEventId(eventId);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const closeCancelModal = () => {
    setShowCancelModal(false);
    setCancelEventId(null);
    setCancelReason('');
  };

  const cancelEvent = async () => {
    if (cancelEventId === null) return;

    setError('');

    const validationError = validateCancellationReason(cancelReason);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/packages/events/${cancelEventId}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || 'Could not cancel this event right now.');
      }

      await loadEvents();
      if (selectedEvent?.id === cancelEventId) {
        setShowDetailModal(false);
        setSelectedEvent(null);
      }

      closeCancelModal();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Could not cancel this event right now.');
    }
  };

  const addStaffSelect = () => {
    setEditFormState((prev) => ({
      ...prev,
      staff_ids: [...prev.staff_ids, ''],
    }));
  };

  const removeStaffSelect = (index: number) => {
    setEditFormState((prev) => {
      const updated = prev.staff_ids.filter((_, i) => i !== index);
      return {
        ...prev,
        staff_ids: updated.length > 0 ? updated : [''],
      };
    });
  };

  const updateStaffSelect = (index: number, value: string) => {
    setEditFormState((prev) => {
      const updated = [...prev.staff_ids];
      updated[index] = value;
      return { ...prev, staff_ids: updated };
    });
  };

  const addItemRequirement = () => {
    setEditFormState((prev) => ({
      ...prev,
      item_requirements: [...prev.item_requirements, { resource_id: '', quantity_required: '' }],
    }));
  };

  const removeItemRequirement = (index: number) => {
    setEditFormState((prev) => {
      const updated = prev.item_requirements.filter((_, i) => i !== index);
      return {
        ...prev,
        item_requirements: updated.length > 0 ? updated : [{ resource_id: '', quantity_required: '' }],
      };
    });
  };

  const updateItemRequirement = (index: number, field: keyof ItemRequirement, value: string) => {
    setEditFormState((prev) => {
      const updated = [...prev.item_requirements];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, item_requirements: updated };
    });
  };

  const validateEditForm = () => {
    if (!editFormState.name.trim()) return 'Please enter an event name.';
    if (!editFormState.description.trim()) return 'Please enter an event description.';

    const capacity = Number(editFormState.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) return 'Capacity must be at least 1.';

    if (!editFormState.start_date) return 'Please select a start date.';
    if (!editFormState.start_time || !editFormState.end_time) return 'Please select both a start time and an end time.';

    if (editScheduleConstraintError) return editScheduleConstraintError;

    const start = combineDateAndTime(editFormState.start_date, editFormState.start_time);
    const end = combineDateAndTime(editFormState.start_date, editFormState.end_time);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return 'End time must be later than start time.';
    }

    const nowRounded = roundUpToNextThirtyMinutes(new Date());
    if (start < nowRounded) {
      return 'Please choose a future start time.';
    }

    if (editActiveWindow) {
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const endMinutes = end.getHours() * 60 + end.getMinutes();
      const isMidnightNextDay = editFormState.end_time === MIDNIGHT_NEXT_DAY;

      if (startMinutes < editActiveWindow.start) {
        return 'Start time needs to be within the selected shift window.';
      }

      if (!isMidnightNextDay && endMinutes > editActiveWindow.end) {
        return 'End time needs to be within the selected shift window.';
      }

      if (isMidnightNextDay && editActiveWindow.end !== 1440) {
        return 'Only night-shift events can end at 12:00 AM the next day.';
      }
    }

    const chosenStaff = editFormState.staff_ids.filter((value) => value !== '');
    if (chosenStaff.length === 0) return 'Please select at least one staff member.';

    const validItems = editFormState.item_requirements.filter((item) => item.resource_id !== '' && item.quantity_required !== '');
    if (validItems.length === 0) return 'Please add at least one required item and quantity.';

    for (const item of validItems) {
      const qty = Number(item.quantity_required);
      if (!Number.isInteger(qty) || qty < 1) return 'Each required item quantity must be at least 1.';
    }

    return null;
  };

  const saveEdit = async (eventId: number) => {
    setError('');

    const validationError = validateEditForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      name: editFormState.name.trim(),
      description: editFormState.description.trim(),
      capacity: Number(editFormState.capacity),
      start_time: combineDateAndTime(editFormState.start_date as Date, editFormState.start_time).toISOString(),
      end_time: combineDateAndTime(editFormState.start_date as Date, editFormState.end_time).toISOString(),
      staff_ids: editFormState.staff_ids.filter((value) => value !== '').map((value) => Number(value)),
      item_requirements: editFormState.item_requirements
        .filter((item) => item.resource_id !== '' && item.quantity_required !== '')
        .map((item) => ({
          resource_id: Number(item.resource_id),
          quantity_required: Number(item.quantity_required),
        })),
    };

    try {
      const response = await fetch(`${API_URL}/api/packages/events/${eventId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || 'Could not save event changes. Please try again.');
      }

      setEditingEventId(null);
      setEditFormState(emptyForm);
      await loadEvents();
      if (selectedEvent?.id === eventId) {
        await openEventDetail(eventId);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Could not save event changes. Please try again.');
    }
  };

  if (loading) {
    return <p>Loading package events...</p>;
  }

  return (
    <div>
      {success && (
        <div
          style={{
            backgroundColor: 'rgba(36, 128, 52, 0.18)',
            color: '#0e4a1a',
            border: '1px solid rgba(36, 128, 52, 0.4)',
            padding: '8px',
            borderRadius: '6px',
            marginBottom: '8px',
          }}
        >
          {success}
        </div>
      )}
      {error && <div className="errorMessage">{error}</div>}

      {events.length === 0 ? (
        <p>{onlyJoined ? 'You have no current or future package reservations.' : 'No active package events are available right now.'}</p>
      ) : (
        <table className="inventoryTable">
          <thead>
            <tr>
              <th>Event Name</th>
              <th>Spots Left</th>
              <th>Staff Running</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{event.name}</td>
                <td>{Number(event.spots_left) <= 0 ? 'FULL' : event.spots_left}</td>
                <td>{event.staff_names || 'TBD'}</td>
                <td>
                  <button type="button" className="smallButton" onClick={() => openEventDetail(event.id)}>
                    View Details
                  </button>
                  <button type="button" className="smallButton" onClick={() => openEventReviews(event.id, event.name)}>
                    View Reviews
                  </button>
                  {canManageEvent(event) && (
                    <>
                      <button type="button" className="smallButton" onClick={() => beginEditEvent(event.id)}>
                        Edit
                      </button>
                      <button type="button" className="smallButton" onClick={() => openCancelModal(event.id)}>
                        Cancel
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showDetailModal && selectedEvent && (
        <div
          className="modalOverlay"
          onClick={() => {
            setShowDetailModal(false);
            setEditingEventId(null);
          }}
        >
          <div
            className="modalContent packageEventModalContent"
            style={{ maxWidth: '700px', padding: '20px', maxHeight: '85vh', overflowY: 'auto', overflowX: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modalHeader">
              <h3 style={{ margin: 0 }}>{selectedEvent.name}</h3>
              <button
                className="modalCloseButton"
                onClick={() => {
                  setShowDetailModal(false);
                  setEditingEventId(null);
                }}
                aria-label="Close event details"
              >
                x
              </button>
            </div>
            <p>{selectedEvent.description}</p>
            <p><strong>Spots Left:</strong> {Number(selectedEvent.spots_left) <= 0 ? 'FULL' : selectedEvent.spots_left}</p>
            <p><strong>Start:</strong> {toReadableDateTime(selectedEvent.start_time)}</p>
            <p><strong>End:</strong> {toReadableDateTime(selectedEvent.end_time)}</p>
            <p>
              <strong>Staff Running:</strong>{' '}
              {selectedEvent.staff?.length
                ? selectedEvent.staff.map((staff: any) => `${staff.name} (${staff.shift})`).join(', ')
                : 'TBD'}
            </p>

            {Array.isArray(selectedEvent.attendees) && (
              <div>
                <p style={{ marginBottom: '8px' }}><strong>Attendees:</strong></p>
                {selectedEvent.attendees.length === 0 ? (
                  <p style={{ marginTop: 0 }}>No attendees have joined yet.</p>
                ) : (
                  <ul style={{ marginTop: 0, paddingLeft: '20px' }}>
                    {selectedEvent.attendees.map((attendee: any) => (
                      <li key={attendee.id}>
                        {attendee.name} ({attendee.email})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {editingEventId === selectedEvent.id && (
              <div style={{ marginTop: '14px', borderTop: '1px solid #ddd', paddingTop: '14px' }}>
                <h4>Edit Event</h4>
                <label>
                  Event Name:
                  <input
                    className="itemInput"
                    value={editFormState.name}
                    onChange={(e) => setEditFormState((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </label>
                <br />
                <label>
                  Description:
                  <textarea
                    className="itemInput"
                    style={{ minHeight: '80px' }}
                    value={editFormState.description}
                    onChange={(e) => setEditFormState((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </label>
                <br />
                <label>
                  Capacity:
                  <input
                    className="quantityInput"
                    type="number"
                    min="1"
                    value={editFormState.capacity}
                    onChange={(e) => setEditFormState((prev) => ({ ...prev, capacity: e.target.value }))}
                  />
                </label>
                <br />
                <label>
                  Start Date:
                  <DatePicker
                    onChange={(value) => setEditFormState((prev) => ({
                      ...prev,
                      start_date: Array.isArray(value) ? value[0] : value,
                      start_time: '',
                      end_time: '',
                    }))}
                    value={editFormState.start_date}
                    minDate={new Date()}
                  />
                </label>
                <br />
                <label>
                  Start Time:
                  <select
                    className="timeInput"
                    value={editFormState.start_time}
                    onChange={(e) => setEditFormState((prev) => ({ ...prev, start_time: e.target.value, end_time: '' }))}
                  >
                    <option value="">-- Select start time --</option>
                    {editStartTimeOptions.map((time) => (
                      <option key={time} value={time}>
                        {formatTimeLabel(time)}
                      </option>
                    ))}
                  </select>
                </label>
                <br />
                <label>
                  End Time:
                  <select
                    className="timeInput"
                    value={editFormState.end_time}
                    onChange={(e) => setEditFormState((prev) => ({ ...prev, end_time: e.target.value }))}
                  >
                    <option value="">-- Select end time --</option>
                    {editEndTimeOptions.map((time) => (
                      <option key={time} value={time}>
                        {formatTimeLabel(time)}
                      </option>
                    ))}
                  </select>
                </label>

                {editScheduleConstraintError && (
                  <div className="errorMessage" style={{ marginTop: '10px' }}>
                    {editScheduleConstraintError}
                  </div>
                )}

                <div style={{ marginTop: '10px' }}>
                  <h4>Staff Running Event</h4>
                  {editFormState.staff_ids.map((staffId, index) => (
                    <div key={`edit-staff-${index}`} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <select
                        className="itemInput"
                        value={staffId}
                        onChange={(e) => updateStaffSelect(index, e.target.value)}
                      >
                        <option value="">-- Select staff --</option>
                        {staffMembers.map((staff) => (
                          <option key={staff.id} value={staff.id}>
                            {staff.name} ({staff.shift})
                          </option>
                        ))}
                      </select>
                      <button type="button" className="removeGuestButton" onClick={() => removeStaffSelect(index)}>
                        Remove
                      </button>
                    </div>
                  ))}
                  <button type="button" className="addGuestButton" onClick={addStaffSelect}>
                    + Add Staff
                  </button>
                </div>

                <div style={{ marginTop: '10px' }}>
                  <h4>Required Items</h4>
                  {editFormState.item_requirements.map((item, index) => (
                    <div key={`edit-item-${index}`} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                      <select
                        className="itemInput"
                        value={item.resource_id}
                        onChange={(e) => updateItemRequirement(index, 'resource_id', e.target.value)}
                      >
                        <option value="">-- Select item --</option>
                        {resources.map((resource) => (
                          <option key={resource.id} value={resource.id}>
                            {resource.name} (Available: {resource.quantity})
                          </option>
                        ))}
                      </select>
                      <input
                        className="quantityInput"
                        type="number"
                        min="1"
                        value={item.quantity_required}
                        onChange={(e) => updateItemRequirement(index, 'quantity_required', e.target.value)}
                      />
                      <button type="button" className="removeGuestButton" onClick={() => removeItemRequirement(index)}>
                        Remove
                      </button>
                    </div>
                  ))}
                  <button type="button" className="addGuestButton" onClick={addItemRequirement}>
                    + Add Item
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button className="submitButton" onClick={() => saveEdit(selectedEvent.id)}>
                    Save Changes
                  </button>
                  <button type="button" className="cancelButton" onClick={() => setEditingEventId(null)}>
                    Cancel Editing
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginTop: '14px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
              {user && Number(selectedEvent.spots_left) > 0 && !selectedEvent.is_joined && (
                <button type="button" className="submitButton" onClick={() => beginPaymentForEvent(selectedEvent.id)}>
                  Reserve My Spot
                </button>
              )}
              {selectedEvent.is_joined && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <span>Spot Reserved</span>
                  <button type="button" className="cancelButton" onClick={() => handleLeaveEvent(selectedEvent.id)}>
                    Cancel Reservation
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ReviewsModal
        isOpen={reviewsOpen}
        title={reviewsTitle}
        subtitle="Reviews are only available for past events that were previously joined by a user."
        reviews={reviews}
        loading={reviewsLoading}
        error={reviewsError}
        emptyMessage="No reviews have been posted for this event yet."
        onClose={() => {
          setReviewsOpen(false);
          setReviewsError('');
        }}
      />

      {showCancelModal && cancelEventId !== null && (
        <div className="modalOverlay" onClick={closeCancelModal}>
          <div
            className="modalContent packageEventModalContent"
            style={{ maxWidth: '560px', padding: '20px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modalHeader">
              <h3 style={{ margin: 0 }}>Cancel Event</h3>
              <button className="modalCloseButton" onClick={closeCancelModal} aria-label="Close cancel event dialog">
                x
              </button>
            </div>

            <p style={{ marginBottom: '8px' }}>
              Enter a cancellation reason. This reason will be included in event status notifications.
            </p>

            <label htmlFor="cancel-reason-input" style={{ display: 'block', marginBottom: '6px' }}>
              Reason
            </label>
            <textarea
              id="cancel-reason-input"
              className="itemInput"
              style={{ width: '100%', minHeight: '120px', resize: 'vertical' }}
              maxLength={500}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Example: Weather alert requires cancellation for guest safety."
            />
            <p style={{ marginTop: '6px', marginBottom: '0', fontSize: '0.9rem' }}>
              {cancelReason.trim().length}/500 characters
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
              <button type="button" className="cancelButton" onClick={closeCancelModal}>
                Keep Event
              </button>
              <button type="button" className="submitButton" onClick={cancelEvent}>
                Submit Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {isPaymentModalOpen && (
        <div className="paymentModalOverlay">
          <div className="paymentModalContent">
            <div className="paymentModalHeader">
              <div>
                <h3>Secure Payment</h3>
                <p className="paymentModalSubtitle">
                  Enter your payment details to reserve your spot for this event.
                </p>
              </div>
              <button type="button" className="paymentModalCloseButton" onClick={closePaymentModal}>
                ✕
              </button>
            </div>

            <div className="paymentForm">
              {success && (
                <div
                  style={{
                    backgroundColor: 'rgba(36, 128, 52, 0.18)',
                    color: '#0e4a1a',
                    border: '1px solid rgba(36, 128, 52, 0.4)',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    marginBottom: '10px',
                  }}
                >
                  {success}
                </div>
              )}

              <div className="paymentFormGrid">
                <label className="paymentField paymentFieldFull">
                  Card Holder&apos;s Name
                  <input
                    type="text"
                    autoComplete="cc-name"
                    value={paymentForm.cardHolderName}
                    onChange={(event) => {
                      setPaymentError('');
                      setSuccess('');
                      setPaymentForm({ ...paymentForm, cardHolderName: event.target.value });
                    }}
                    placeholder="Name as shown on card"
                  />
                </label>

                <label className="paymentField paymentFieldFull">
                  Card Number
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    value={paymentForm.cardNumber}
                    onChange={(event) => {
                      setPaymentError('');
                      setSuccess('');
                      const digitsOnly = event.target.value.replace(/\D/g, '').slice(0, 16);
                      const formatted = digitsOnly.match(/.{1,4}/g)?.join(' ') ?? '';
                      setPaymentForm({ ...paymentForm, cardNumber: formatted });
                    }}
                    placeholder="1234 5678 9012 3456"
                  />
                </label>

                <label className="paymentField">
                  Expiration Date
                  <input
                    type="text"
                    autoComplete="cc-exp"
                    inputMode="numeric"
                    placeholder="12/28"
                    maxLength={5}
                    value={paymentForm.expirationDate}
                    onChange={(event) => {
                      setPaymentError('');
                      setSuccess('');
                      const digitsOnly = event.target.value.replace(/\D/g, '').slice(0, 4);
                      const formatted = digitsOnly.length > 2 ? `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}` : digitsOnly;
                      setPaymentForm({ ...paymentForm, expirationDate: formatted });
                    }}
                  />
                  <span className="paymentFieldHint">Use MM/YY format, for example 12/28.</span>
                </label>

                <label className="paymentField">
                  Security Code
                  <input
                    type="text"
                    autoComplete="cc-csc"
                    inputMode="numeric"
                    maxLength={3}
                    value={paymentForm.securityCode}
                    onChange={(event) => {
                      setPaymentError('');
                      setSuccess('');
                      const digitsOnly = event.target.value.replace(/\D/g, '').slice(0, 3);
                      setPaymentForm({ ...paymentForm, securityCode: digitsOnly });
                    }}
                    placeholder="123"
                  />
                </label>

                <label className="paymentField">
                  ZIP Code
                  <input
                    type="text"
                    autoComplete="postal-code"
                    inputMode="numeric"
                    maxLength={5}
                    value={paymentForm.zipCode}
                    onChange={(event) => {
                      setPaymentError('');
                      setSuccess('');
                      const digitsOnly = event.target.value.replace(/\D/g, '').slice(0, 5);
                      setPaymentForm({ ...paymentForm, zipCode: digitsOnly });
                    }}
                    placeholder="12345"
                  />
                </label>
              </div>

              {paymentError && <div className="paymentError">{paymentError}</div>}

              <div className="paymentActions">
                <button type="button" className="paymentSecondaryButton" onClick={closePaymentModal}>
                  Cancel
                </button>
                <button type="button" className="paymentPrimaryButton" onClick={() => void handlePaymentSubmit()}>
                  Complete Reservation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

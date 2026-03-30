/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { fetchData } from './api';
import DatePicker from 'react-date-picker';
import 'react-date-picker/dist/DatePicker.css';
import 'react-calendar/dist/Calendar.css';

const API_URL = import.meta.env.VITE_API_URL;
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

export default function PackageEventsList({ showManagement = false }: Props) {
  const { user } = useAuth();

  const [events, setEvents] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [editFormState, setEditFormState] = useState<EventFormState>(emptyForm);

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
    if (user.role === 'admin') return true;
    return user.role === 'staff' && Number(event.created_by) === Number(user.userId);
  };

  const loadEvents = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchData('/api/packages/events');
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError('Unable to load package events right now. Please try again.');
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
  }, []);

  const openEventDetail = async (eventId: number) => {
    setError('');
    try {
      const detail = await fetchData(`/api/packages/events/${eventId}`);
      setSelectedEvent(detail);
      setShowDetailModal(true);
    } catch (err) {
      console.error(err);
      setError('Unable to load event details right now. Please try again.');
    }
  };

  const handleJoinEvent = async (eventId: number) => {
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/packages/events/${eventId}/join`, {
        method: 'POST',
        credentials: 'include',
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || 'Could not join this event right now.');
      }

      await loadEvents();
      await openEventDetail(eventId);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Could not join this event right now.');
    }
  };

  const beginEditEvent = async (eventId: number) => {
    setError('');
    try {
      const detail = await fetchData(`/api/packages/events/${eventId}`);

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

  const cancelEvent = async (eventId: number) => {
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/packages/events/${eventId}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || 'Could not cancel this event right now.');
      }

      await loadEvents();
      if (selectedEvent?.id === eventId) {
        setShowDetailModal(false);
        setSelectedEvent(null);
      }
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
      {error && <div className="errorMessage">{error}</div>}

      {events.length === 0 ? (
        <p>No active package events are available right now.</p>
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
                  <button className="smallButton" onClick={() => openEventDetail(event.id)}>
                    View
                  </button>
                  {canManageEvent(event) && (
                    <>
                      <button className="smallButton" onClick={() => beginEditEvent(event.id)}>
                        Edit
                      </button>
                      <button className="smallButton" onClick={() => cancelEvent(event.id)}>
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
        <div className="modalOverlay">
          <div className="modalContent" style={{ maxWidth: '700px', padding: '20px' }}>
            <h3>{selectedEvent.name}</h3>
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
                  <button className="primaryButton" onClick={() => setEditingEventId(null)}>
                    Stop Editing
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
              <button className="primaryButton" onClick={() => setShowDetailModal(false)}>
                Close
              </button>
              {user && Number(selectedEvent.spots_left) > 0 && !selectedEvent.is_joined && (
                <button className="submitButton" onClick={() => handleJoinEvent(selectedEvent.id)}>
                  Reserve My Spot
                </button>
              )}
              {selectedEvent.is_joined && <span>You already joined this event.</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

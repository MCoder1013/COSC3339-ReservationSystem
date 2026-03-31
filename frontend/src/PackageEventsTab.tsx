/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { fetchData } from './api';
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
  end_time: string;
  staff_ids: string[];
  item_requirements: ItemRequirement[];
};

const SHIFT_WINDOWS: Record<Shift, ShiftWindow> = {
  Morning: { start: 360, end: 720 },
  Day: { start: 720, end: 1080 },
  Night: { start: 1080, end: 1440 },
};

const emptyForm: EventFormState = {
  name: '',
  description: '',
  capacity: '',
  start_date: new Date(),
  start_time: '',
  end_time: '',
  staff_ids: [''],
  item_requirements: [{ resource_id: '', quantity_required: '' }],
};

function toShift(value: string): Shift | null {
  if (value === 'Morning' || value === 'Day' || value === 'Night') {
    return value;
  }
  return null;
}

function toTimeValue(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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

function roundUpToNextThirtyMinutes(d: Date) {
  const rounded = new Date(d);
  rounded.setSeconds(0, 0);
  const remainder = rounded.getMinutes() % 30;
  if (remainder !== 0) {
    rounded.setMinutes(rounded.getMinutes() + (30 - remainder));
  }
  return rounded;
}

function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
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

function combineStartDateAndTime(date: Date, timeStr: string) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function combineEndDateAndTime(startDate: Date, endTime: string) {
  if (endTime === MIDNIGHT_NEXT_DAY) {
    const result = new Date(startDate);
    result.setDate(result.getDate() + 1);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  const [hours, minutes] = endTime.split(':').map(Number);
  const result = new Date(startDate);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export default function PackageEventsTab() {
  const { user } = useAuth();

  const [resources, setResources] = useState<any[]>([]);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formState, setFormState] = useState<EventFormState>(emptyForm);

  const canCreate = user?.role === 'staff' || user?.role === 'admin';

  const staffOptions = useMemo(() => {
    return staffMembers.filter((staff) => !!staff.id);
  }, [staffMembers]);

  const resourceOptions = useMemo(() => {
    return resources.filter((resource) => resource.status === 'Available');
  }, [resources]);

  const creatorShift = useMemo(() => {
    if (!user?.userId) return null;
    const creator = staffOptions.find((staff) => Number(staff.id) === Number(user.userId));
    return creator ? toShift(creator.shift) : null;
  }, [staffOptions, user?.userId]);

  const selectedStaffShifts = useMemo(() => {
    const chosenIds = formState.staff_ids
      .filter((value) => value !== '')
      .map((value) => Number(value));

    return chosenIds
      .map((id) => staffOptions.find((staff) => Number(staff.id) === id))
      .map((staff) => toShift(staff?.shift))
      .filter((shift): shift is Shift => shift !== null);
  }, [formState.staff_ids, staffOptions]);

  const activeWindow = useMemo(() => {
    if (!creatorShift) return null;
    return getEffectiveShiftWindow([creatorShift, ...selectedStaffShifts]);
  }, [creatorShift, selectedStaffShifts]);

  const scheduleConstraintError = useMemo(() => {
    if (!canCreate) return '';
    if (!creatorShift) return 'We could not find your shift details. Please contact an admin.';

    if (formState.staff_ids.some((id) => id !== '')) {
      if (!activeWindow) {
        return 'Selected staff do not share an overlapping shift window for this event.';
      }
    }

    return '';
  }, [activeWindow, canCreate, creatorShift, formState.staff_ids]);

  const startTimeOptions = useMemo(() => {
    if (!formState.start_date || !activeWindow) return [];

    const nowRounded = roundUpToNextThirtyMinutes(new Date());
    const minMinutes = isSameLocalDay(formState.start_date, nowRounded)
      ? Math.max(activeWindow.start, nowRounded.getHours() * 60 + nowRounded.getMinutes())
      : activeWindow.start;

    const options: string[] = [];
    for (let minute = minMinutes; minute < activeWindow.end; minute += 30) {
      options.push(toTimeValue(minute));
    }

    return options;
  }, [activeWindow, formState.start_date]);

  const endTimeOptions = useMemo(() => {
    if (!activeWindow || !formState.start_time) return [] as string[];

    const [startHours, startMinutes] = formState.start_time.split(':').map(Number);
    const selectedStartMinutes = startHours * 60 + startMinutes;

    const options: string[] = [];

    const sameDayMax = Math.min(activeWindow.end, 1410);
    for (let minute = selectedStartMinutes + 30; minute <= sameDayMax; minute += 30) {
      options.push(toTimeValue(minute));
    }

    if (activeWindow.end === 1440 && selectedStartMinutes < 1440) {
      options.push(MIDNIGHT_NEXT_DAY);
    }

    return options;
  }, [activeWindow, formState.start_time]);

  const loadCreateFormData = async () => {
    if (!canCreate) return;

    try {
      const [resourcesData, staffData] = await Promise.all([
        fetchData('/api/resources'),
        fetchData('/api/staff'),
      ]);

      setResources(Array.isArray(resourcesData) ? resourcesData : []);
      setStaffMembers(Array.isArray(staffData) ? staffData : []);
    } catch (err) {
      console.error(err);
      setError('Unable to load resources and staff for event creation. Please try again.');
    }
  };

  useEffect(() => {
    loadCreateFormData();
  }, []);

  useEffect(() => {
    if (formState.start_time && !startTimeOptions.includes(formState.start_time)) {
      setFormState((prev) => ({ ...prev, start_time: '', end_time: '' }));
      return;
    }

    if (formState.end_time && !endTimeOptions.includes(formState.end_time)) {
      setFormState((prev) => ({ ...prev, end_time: '' }));
    }
  }, [endTimeOptions, formState.end_time, formState.start_time, startTimeOptions]);

  const addStaffSelect = () => {
    setFormState((prev) => ({
      ...prev,
      staff_ids: [...prev.staff_ids, ''],
    }));
  };

  const removeStaffSelect = (index: number) => {
    setFormState((prev) => {
      const updated = prev.staff_ids.filter((_, i) => i !== index);
      return {
        ...prev,
        staff_ids: updated.length > 0 ? updated : [''],
      };
    });
  };

  const updateStaffSelect = (index: number, value: string) => {
    setFormState((prev) => {
      const updated = [...prev.staff_ids];
      updated[index] = value;
      return { ...prev, staff_ids: updated };
    });
  };

  const addItemRequirement = () => {
    setFormState((prev) => ({
      ...prev,
      item_requirements: [...prev.item_requirements, { resource_id: '', quantity_required: '' }],
    }));
  };

  const removeItemRequirement = (index: number) => {
    setFormState((prev) => {
      const updated = prev.item_requirements.filter((_, i) => i !== index);
      return {
        ...prev,
        item_requirements: updated.length > 0 ? updated : [{ resource_id: '', quantity_required: '' }],
      };
    });
  };

  const updateItemRequirement = (index: number, field: keyof ItemRequirement, value: string) => {
    setFormState((prev) => {
      const updated = [...prev.item_requirements];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, item_requirements: updated };
    });
  };

  const resetForm = () => {
    setFormState(emptyForm);
    setSuccess('');
  };

  const validateForm = () => {
    if (!formState.name.trim()) return 'Please enter an event name.';
    if (!formState.description.trim()) return 'Please enter an event description.';

    const capacity = Number(formState.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) return 'Capacity must be at least 1.';

    if (scheduleConstraintError) return scheduleConstraintError;

    if (!formState.start_date) return 'Please select a start date.';
    if (!formState.start_time || !formState.end_time) return 'Please select both a start time and an end time.';

    const start = combineStartDateAndTime(formState.start_date, formState.start_time);
    const end = combineEndDateAndTime(formState.start_date, formState.end_time);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return 'End time must be later than start time.';
    }

    const nowRounded = roundUpToNextThirtyMinutes(new Date());
    if (start < nowRounded) {
      return 'Please choose a future start time.';
    }

    if (activeWindow) {
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const endMinutes = end.getHours() * 60 + end.getMinutes();
      const isMidnightNextDay = formState.end_time === MIDNIGHT_NEXT_DAY;

      if (startMinutes < activeWindow.start) {
        return 'Start time needs to be within the selected shift window.';
      }

      if (!isMidnightNextDay && endMinutes > activeWindow.end) {
        return 'End time needs to be within the selected shift window.';
      }

      if (isMidnightNextDay && activeWindow.end !== 1440) {
        return 'Only night-shift events can end at 12:00 AM the next day.';
      }
    }

    const chosenStaff = formState.staff_ids.filter((value) => value !== '');
    if (chosenStaff.length === 0) return 'Please select at least one staff member.';

    const validItems = formState.item_requirements.filter((item) => item.resource_id !== '' && item.quantity_required !== '');
    if (validItems.length === 0) return 'Please add at least one required item and quantity.';

    for (const item of validItems) {
      const qty = Number(item.quantity_required);
      if (!Number.isInteger(qty) || qty < 1) return 'Each required item quantity must be at least 1.';
    }

    return null;
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const start = combineStartDateAndTime(formState.start_date as Date, formState.start_time);
    const end = combineEndDateAndTime(formState.start_date as Date, formState.end_time);

    const payload = {
      name: formState.name.trim(),
      description: formState.description.trim(),
      capacity: Number(formState.capacity),
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      staff_ids: formState.staff_ids.filter((value) => value !== '').map((value) => Number(value)),
      item_requirements: formState.item_requirements
        .filter((item) => item.resource_id !== '' && item.quantity_required !== '')
        .map((item) => ({
          resource_id: Number(item.resource_id),
          quantity_required: Number(item.quantity_required),
        })),
    };

    try {
      const response = await fetch(`${API_URL}/api/packages/events`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get('content-type') || '';
      const body = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : null;

      if (!response.ok) {
        throw new Error(body?.error || 'Could not save the event. Please try again.');
      }

      if (!body || typeof body.eventId !== 'number') {
        throw new Error('The server response was invalid. The event may not have been saved.');
      }

      resetForm();
      setSuccess(`Event created successfully (ID: ${body.eventId}).`);
      window.dispatchEvent(new CustomEvent('package-events-updated'));
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Could not save the event. Please try again.');
    }
  };

  return (
    <div>
      {canCreate && (
        <div style={{ marginBottom: '24px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '16px' }}>
          <h3 style={{ marginTop: 0 }}>Create Event</h3>
          {error && <div className="errorMessage" style={{ marginBottom: '10px' }}>{error}</div>}
          {success && <div style={{ color: '#0f7b0f', marginBottom: '10px' }}>{success}</div>}
          <form onSubmit={submitForm}>
            <label>
              Event Name:
              <input
                className="itemInput"
                value={formState.name}
                onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </label>

            <br />

            <label>
              Description:
              <textarea
                className="itemInput"
                style={{ minHeight: '90px' }}
                value={formState.description}
                onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                required
              />
            </label>

            <br />

            <label>
              Capacity:
              <input
                className="quantityInput"
                type="number"
                min="1"
                value={formState.capacity}
                onChange={(e) => setFormState((prev) => ({ ...prev, capacity: e.target.value }))}
                required
              />
            </label>

            <br />

            <label>
              Start Date:
              <DatePicker
                onChange={(value) => setFormState((prev) => ({ ...prev, start_date: Array.isArray(value) ? value[0] : value, start_time: '', end_time: '' }))}
                value={formState.start_date}
                minDate={new Date()}
                required
              />
            </label>

            <br />

            <label>
              Start Time:
              <select
                className="timeInput"
                value={formState.start_time}
                onChange={(e) => setFormState((prev) => ({ ...prev, start_time: e.target.value, end_time: '' }))}
                required
              >
                <option value="">-- Select start time --</option>
                {startTimeOptions.map((time) => (
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
                value={formState.end_time}
                onChange={(e) => setFormState((prev) => ({ ...prev, end_time: e.target.value }))}
                required
              >
                <option value="">-- Select end time --</option>
                {endTimeOptions.map((time) => (
                  <option key={time} value={time}>
                    {formatTimeLabel(time)}
                  </option>
                ))}
              </select>
            </label>

            <br />

            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ marginBottom: '8px' }}>Staff Running Event</h4>
              {formState.staff_ids.map((staffId, index) => (
                <div key={`staff-${index}`} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <select
                    className="itemInput"
                    value={staffId}
                    onChange={(e) => updateStaffSelect(index, e.target.value)}
                    required
                  >
                    <option value="">-- Select staff --</option>
                    {staffOptions.map((staff) => (
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

            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ marginBottom: '8px' }}>Required Items</h4>
              {formState.item_requirements.map((item, index) => (
                <div key={`item-${index}`} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                  <select
                    className="itemInput"
                    value={item.resource_id}
                    onChange={(e) => updateItemRequirement(index, 'resource_id', e.target.value)}
                    required
                  >
                    <option value="">-- Select item --</option>
                    {resourceOptions.map((resource) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.name} (Available: {resource.quantity})
                      </option>
                    ))}
                  </select>
                  <input
                    className="quantityInput"
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={item.quantity_required}
                    onChange={(e) => updateItemRequirement(index, 'quantity_required', e.target.value)}
                    required
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

            {scheduleConstraintError && (
              <div className="errorMessage" style={{ marginBottom: '10px' }}>
                {scheduleConstraintError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="submitButton">
                Create Event
              </button>
              <button type="button" className="primaryButton" onClick={resetForm}>
                Clear Form
              </button>
            </div>
          </form>
        </div>
      )}

      {!canCreate && <p>Only staff and admins can create events.</p>}
    </div>
  );
}

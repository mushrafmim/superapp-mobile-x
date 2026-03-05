import React, { useState, useEffect } from "react";
import { Card, Button, Input, Select } from "../components/UI";
import { LeaveType } from "../types";
import { AlertCircle, Calendar as CalendarIcon } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { formatDuration } from "../utils/formatters";

interface AddLeaveProps {
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  balances: any;
  holidays: string[];
}

export const AddLeave: React.FC<AddLeaveProps> = ({
  onSubmit,
  onCancel,
  balances,
  holidays,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    type: "sick" as LeaveType,
    startDate: "",
    endDate: "",
    reason: "",
  });

  const [duration, setDuration] = useState(0);
  const [leaveMode, setLeaveMode] = useState<"single" | "multiple">("multiple");
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(
    formData.startDate
      ? new Date(`${formData.startDate}T00:00:00`)
      : new Date(),
  );
  const [halfDayPeriod, setHalfDayPeriod] = useState<
    "morning" | "evening" | null
  >(null);

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (formData.startDate) {
      setCalendarMonth(new Date(`${formData.startDate}T00:00:00`));
    }
  }, [formData.startDate]);

  useEffect(() => {
    if (!formData.startDate) {
      setDuration(0);
      return;
    }

    if (leaveMode === "single") {
      const date = new Date(`${formData.startDate}T00:00:00`);
      const day = date.getDay();
      const isWeekend = day === 0 || day === 6;
      const isHoliday = holidays.includes(formData.startDate);

      if (isWeekend || isHoliday) {
        setDuration(0);
        return;
      }

      setDuration(isHalfDay ? 0.5 : 1);
      return;
    }

    if (formData.startDate && formData.endDate) {
      const start = new Date(`${formData.startDate}T00:00:00`);
      const end = new Date(`${formData.endDate}T00:00:00`);
      if (start <= end) {
        setDuration(
          formatDuration(formData.startDate, formData.endDate, holidays),
        );
      } else {
        setDuration(0);
      }
    }
  }, [formData.startDate, formData.endDate, holidays, leaveMode, isHalfDay]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.startDate || !formData.endDate || !formData.reason) {
      setError("Please fill in all fields");
      return;
    }
    if (leaveMode === "single" && isHalfDay && !halfDayPeriod) {
      setError("Please select morning or evening for half day");
      return;
    }

    setIsLoading(true);
    try {
      const payload =
        leaveMode === "single"
          ? {
              ...formData,
              isHalfDay,
              halfDayPeriod: isHalfDay ? halfDayPeriod : undefined,
            }
          : {
              ...formData,
            };

      await onSubmit(payload);
      onCancel();
    } catch (e: any) {
      setError(e.message || "Failed to submit request");
    } finally {
      setIsLoading(false);
    }
  };

  const isHoliday = (date: Date) => {
    const formatted = formatDate(date);
    return holidays.includes(formatted);
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const isSelectedRange = (date: Date) => {
    if (!formData.startDate || !formData.endDate) return false;

    const start = new Date(`${formData.startDate}T00:00:00`);
    const end = new Date(`${formData.endDate}T00:00:00`);

    // Normalize all dates to midnight
    const normalize = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate());

    const normalizedDate = normalize(date);
    const normalizedStart = normalize(start);
    const normalizedEnd = normalize(end);

    const isInRange =
      normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd;

    // Exclude weekends
    const day = normalizedDate.getDay();
    const isWeekendDay = day === 0 || day === 6;

    // Exclude holidays
    const formatted = formatDate(normalizedDate);
    const isHolidayDay = holidays.includes(formatted);

    return isInRange && !isWeekendDay && !isHolidayDay;
  };

  const remaining = balances ? balances[formData.type] : 0;
  const isOverLimit = duration > remaining;

  return (
    <div className="pb-24 animate-in slide-in-from-bottom-4 duration-300">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-800">Request Time Off</h2>
        <p className="text-sm text-slate-500">Fill out the details below.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm flex items-start">
              <AlertCircle size={16} className="mr-2 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
              Leave Type
            </label>
            <Select
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value as LeaveType })
              }
            >
              <option value="sick">Sick Leave</option>
              <option value="annual">Annual Leave</option>
              <option value="casual">Casual Leave</option>
            </Select>
            <div className="mt-2 text-xs text-right">
              <span className="text-slate-500">Balance: </span>
              <span
                className={`font-bold ${remaining === 0 ? "text-red-500" : "text-emerald-600"}`}
              >
                {remaining} days available
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
              Leave Mode
            </label>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  checked={leaveMode === "single"}
                  onChange={() => {
                    setLeaveMode("single");
                    setFormData((prev) => ({
                      ...prev,
                      endDate: prev.startDate,
                    }));
                  }}
                />
                One Day
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  checked={leaveMode === "multiple"}
                  onChange={() => {
                    setLeaveMode("multiple");
                    setIsHalfDay(false);
                  }}
                />
                Sequence Days
              </label>
            </div>
          </div>

          {leaveMode === "single" ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                  Date
                </label>
                <Input
                  type="date"
                  required
                  value={formData.startDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      startDate: e.target.value,
                      endDate: e.target.value,
                    })
                  }
                />
              </div>

              {leaveMode === "single" &&
                formData.startDate &&
                duration === 0 && (
                  <div className="p-3 rounded-xl text-sm border bg-red-50 border-red-200 text-red-700">
                    Selected date is a weekend or public holiday. Please choose
                    a working day.
                  </div>
                )}

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                  Duration
                </label>

                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      checked={!isHalfDay}
                      onChange={() => {
                        setIsHalfDay(false);
                        setHalfDayPeriod(null);
                      }}
                    />
                    Full Day
                  </label>

                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      checked={isHalfDay}
                      onChange={() => setIsHalfDay(true)}
                    />
                    Half Day
                  </label>
                </div>
              </div>

              {isHalfDay && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                    Period
                  </label>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        checked={halfDayPeriod === "morning"}
                        onChange={() => setHalfDayPeriod("morning")}
                      />
                      Morning
                    </label>

                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        checked={halfDayPeriod === "evening"}
                        onChange={() => setHalfDayPeriod("evening")}
                      />
                      Evening
                    </label>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                  From
                </label>
                <Input
                  type="date"
                  required
                  value={formData.startDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                  To
                </label>
                <Input
                  type="date"
                  required
                  value={formData.endDate}
                  min={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          {duration > 0 && (
            <div
              className={`p-3 rounded-xl text-sm border ${
                isOverLimit
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-blue-50 border-blue-200 text-blue-700"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="flex items-center">
                  <CalendarIcon size={16} className="mr-2" />
                  Leave will apply for:
                </span>
                <span className="font-bold">{duration} Days</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
              Reason
            </label>
            <textarea
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 min-h-[100px] resize-none"
              placeholder="Describe why you need time off..."
              required
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
            />
          </div>

          <div className="flex flex-col items-center">
            <DayPicker
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              showOutsideDays
              disabled={[{ before: new Date() }, isWeekend, isHoliday]}
              modifiers={{
                selectedRange: isSelectedRange,
                holiday: isHoliday,
              }}
              modifiersStyles={{
                selectedRange: {
                  backgroundColor: "rgba(37, 99, 235, 0.3)",
                  color: "#1e3a8a",
                },
                holiday: {
                  backgroundColor: "rgba(239, 68, 68, 0.4)",
                  color: "#991b1b",
                },
              }}
            />
            {/* Calendar Legend */}
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-600 w-full text-center">
              <div className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-sm bg-blue-600/60"></span>
                <span>Days you will be on leave</span>
              </div>

              <div className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-sm bg-red-500/70"></span>
                <span>Public holidays</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              isLoading={isLoading}
              disabled={isOverLimit || duration <= 0 || formData.reason === ""}
            >
              Submit Request
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

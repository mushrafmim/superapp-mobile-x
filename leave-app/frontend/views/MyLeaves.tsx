import React from "react";
import { Leave } from "../types";
import { Card, Badge, Button, Modal } from "../components/UI";
import { Filters } from "../components/Filters";
import { formatDate, formatDuration } from "../utils/formatters";
import { Calendar, Clock, Trash2, PlusCircle, AlertCircle } from "lucide-react";

interface MyLeavesProps {
  leaves: Leave[];
  balances: any;
  holidays: string[];
  onDelete: (id: string) => void;
  onRequestNew: () => void;
  filters: any;
}

const BalanceCard = ({
  type,
  remaining,
  total,
}: {
  type: string;
  remaining: number;
  total: number;
}) => {
  const percent = total > 0 ? Math.min(100, (remaining / total) * 100) : 0;
  const isLow = percent < 20 && total > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm flex flex-col justify-between">
      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
        {type}
      </span>
      <div className="mt-2">
        <span
          className={`text-xl font-bold ${isLow ? "text-red-500" : "text-slate-800"}`}
        >
          {remaining}
        </span>
        <span className="text-xs text-slate-400"> / {total}</span>
      </div>
      <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
        <div
          className={`h-full rounded-full ${isLow ? "bg-red-400" : "bg-primary-500"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

export const MyLeaves: React.FC<MyLeavesProps> = ({
  leaves,
  balances,
  holidays,
  onDelete,
  onRequestNew,
  filters,
}) => {
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(
    null,
  );

  const openDeleteModal = (id: string) => setPendingDeleteId(id);
  const closeDeleteModal = () => setPendingDeleteId(null);
  const confirmDelete = () => {
    if (pendingDeleteId) onDelete(pendingDeleteId);
    closeDeleteModal();
  };

  return (
    <div className="space-y-6 pb-24">
      <section>
        <h2 className="text-xs font-bold uppercase text-slate-400 mb-3 px-1 tracking-wide">
          Your Balances
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <BalanceCard
            type="Annual"
            remaining={balances.annual}
            total={balances.total.annual}
          />
          <BalanceCard
            type="Sick"
            remaining={balances.sick}
            total={balances.total.sick}
          />
          <BalanceCard
            type="Casual"
            remaining={balances.casual}
            total={balances.total.casual}
          />
        </div>
      </section>

      <Button
        onClick={onRequestNew}
        className="w-full py-4 text-base shadow-lg shadow-primary-500/20 bg-slate-900 text-white hover:bg-slate-800"
      >
        <PlusCircle className="mr-2" size={20} />
        Request Time Off
      </Button>

      <div className="border-t border-slate-200 pt-4">
        <Filters
          hideSearch
          type={filters.typeFilter}
          onTypeChange={filters.setTypeFilter}
          status={filters.statusFilter}
          onStatusChange={filters.setStatusFilter}
          startDate={filters.startDate}
          onStartDateChange={filters.setStartDate}
          endDate={filters.endDate}
          onEndDateChange={filters.setEndDate}
        />

        {leaves.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 mt-4">
            <Calendar className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm">No leave requests found.</p>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            {leaves.map((leave) => (
              <Card
                key={leave.id}
                className="relative overflow-hidden group transition-all hover:shadow-md"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex space-x-2">
                    <Badge status={leave.type} />
                    <Badge status={leave.status} />
                  </div>
                  {leave.status === "pending" && (
                    <button
                      onClick={() => openDeleteModal(leave.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <h3 className="font-semibold text-slate-800 mb-1">
                  {leave.reason}
                </h3>

                <div className="mt-2 space-y-1.5">
                  {/* Duration and Date details */}
                  {leave.startDate === leave.endDate ? (
                    <>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-600">
                          Duration:
                        </span>
                        {leave.days?.[0]?.isHalfDay 
                          ? `Half Day (${leave.days[0].halfDayPeriod ? (leave.days[0].halfDayPeriod.charAt(0).toUpperCase() + leave.days[0].halfDayPeriod.slice(1)) : ""})` 
                          : "Full Day"}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-600">
                          Date:
                        </span>
                        {formatDate(leave.startDate)}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-1.5">
                      {/* <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-600">
                          From:
                        </span>
                        {formatDate(leave.startDate)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-600">
                          To:
                        </span>
                        {formatDate(leave.endDate)}
                      </div> */}
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-600">
                          Duration:
                        </span>
                        {leave.totalLeaveDays} Days
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        <span className="font-semibold text-slate-600">
                          Days:
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {leave.days?.map((day) => (
                          <span
                            key={day.id}
                            className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200"
                          >
                            {new Intl.DateTimeFormat("en-US", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }).format(new Date(`${day.date}T00:00:00`))}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

                {leave.status === "rejected" && leave.approverComment && (
                  <div className="mt-3 bg-red-50 p-2 rounded-lg text-xs text-red-700 border border-red-100 flex items-start">
                    <AlertCircle size={14} className="mr-1.5 mt-0.5 shrink-0" />
                    <span>
                      <span className="font-semibold">Rejected:</span>{" "}
                      {leave.approverComment}
                    </span>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
      <Modal
        isOpen={!!pendingDeleteId}
        onClose={closeDeleteModal}
        title="Cancel this request?"
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to cancel this leave request? This action cannot
          be undone.
        </p>
        <div className="mt-4 flex gap-2">
          <Button
            variant="secondary"
            onClick={closeDeleteModal}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete} className="flex-1">
            Yes, Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
};

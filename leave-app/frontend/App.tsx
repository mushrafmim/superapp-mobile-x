import React, { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useLeaves } from "./hooks/useLeaves";
import { useUsers } from "./hooks/useUsers";
import { MyLeaves } from "./views/MyLeaves";
import { Approvals } from "./views/Approvals";
import { Reports } from "./views/Reports";
import { AddLeave } from "./views/AddLeave";
import { Admin } from "./views/Admin";
import {
  List,
  CheckSquare,
  BarChart2,
  Loader2,
  RefreshCw,
  Settings,
  Shield,
} from "lucide-react";
import { cn } from "./utils/cn";
import { Allowances } from "./types";
import { Modal, Input, Button } from "./components/UI";
import { Toaster, toast } from "react-hot-toast";

type Tab = "leaves" | "approvals" | "reports" | "admin";

function App() {
  const { user, token, isAdmin, loading, updateUser } = useAuth();

  const {
    leaves,
    rawLeaves,
    balances,
    holidays,
    filters,
    actions,
    loading: leavesLoading,
    refresh,
  } = useLeaves({
    token,
    isAdmin,
    user,
  });

  const { users, updateGlobalAllowances, updateUserRole } = useUsers({
    token,
    isAdmin,
    onGlobalAllowancesUpdate: (allowances) => {
      if (user) {
        updateUser({ ...user, allowances });
      }
    },
  });

  const [activeTab, setActiveTab] = useState<Tab>("leaves");
  const [isAdding, setIsAdding] = useState(false);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [limitForm, setLimitForm] = useState<Allowances>({
    annual: 20,
    sick: 10,
    casual: 5,
  });

  const openLimitModal = () => {
    if (user) {
      setLimitForm(user.allowances);
    }
    setIsLimitModalOpen(true);
  };

  const handleSaveGlobalLimits = async () => {
    await updateGlobalAllowances(limitForm);
    setIsLimitModalOpen(false);
    toast.success("Global allowances updated successfully");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-primary-600 w-8 h-8" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 text-center text-red-500">Authentication Failed.</div>
    );
  }

  const renderContent = () => {
    if (isAdding) {
      return (
        <AddLeave
          onSubmit={actions.createLeave}
          onCancel={() => setIsAdding(false)}
          balances={balances}
          holidays={holidays}
        />
      );
    }

    switch (activeTab) {
      case "leaves":
        return (
          <MyLeaves
            leaves={leaves.filter((l) => l.userId === user.id)}
            balances={balances}
            holidays={holidays}
            onDelete={actions.deleteLeave}
            onRequestNew={() => setIsAdding(true)}
            filters={filters}
          />
        );
      case "approvals":
        return (
          <Approvals
            leaves={rawLeaves || leaves}
            onApprove={actions.approveLeave}
            onReject={actions.rejectLeave}
          />
        );
      case "reports":
        return (
          <Reports
            allLeaves={rawLeaves || leaves}
            isAdmin={isAdmin}
            currentUser={user}
            users={users}
          />
        );
      case "admin":
        return (
          <Admin
            users={users}
            currentUser={user}
            updateUserRole={(userId, role) =>
              updateUserRole(userId, role)
                .then(() => {
                  toast.success(`User role updated to ${role}`);
                })
                .catch((e) => {
                  toast.error(`Failed to update role: ${e?.message || e}`);
                })
            }
            openLimitModal={openLimitModal}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-primary-100 selection:text-primary-900">
      <Toaster position="bottom-center" />

      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            {isAdding
              ? "New Request"
              : activeTab === "approvals"
                ? "Approvals"
                : activeTab === "reports"
                  ? "Reports"
                  : activeTab === "admin"
                    ? "Admin Settings"
                    : "My Leaves"}
          </h1>
          {/* <p className="text-xs text-slate-500">{user.email}</p> */}
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label="Refresh"
            onClick={() => refresh()}
            className="p-2 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {leavesLoading ? (
              <Loader2 className="animate-spin w-5 h-5" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
          </button>
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto min-h-[calc(100vh-140px)]">
        {renderContent()}
      </main>

      <Modal
        isOpen={isLimitModalOpen}
        onClose={() => setIsLimitModalOpen(false)}
        title="Organization Allowances"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 bg-amber-50 p-2.5 rounded-lg border border-amber-100 leading-relaxed">
            <strong className="text-amber-700 block mb-1">Warning</strong>
            Updating these values will overwrite the leave allowance limits for{" "}
            <strong>every employee</strong> in the organization.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                Annual
              </label>
              <Input
                type="number"
                value={limitForm.annual}
                className="text-center font-bold text-slate-700"
                onChange={(e) =>
                  setLimitForm({
                    ...limitForm,
                    annual: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                Sick
              </label>
              <Input
                type="number"
                value={limitForm.sick}
                className="text-center font-bold text-slate-700"
                onChange={(e) =>
                  setLimitForm({
                    ...limitForm,
                    sick: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                Casual
              </label>
              <Input
                type="number"
                value={limitForm.casual}
                className="text-center font-bold text-slate-700"
                onChange={(e) =>
                  setLimitForm({
                    ...limitForm,
                    casual: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
          <div className="pt-3 flex gap-2">
            <Button
              className="flex-1"
              variant="secondary"
              onClick={() => setIsLimitModalOpen(false)}
            >
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSaveGlobalLimits}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {!isAdding && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe pt-2 px-6 flex justify-around items-end h-[80px] z-40">
          <button
            onClick={() => setActiveTab("leaves")}
            className={cn(
              "flex flex-col items-center pb-4 w-16 transition-colors",
              activeTab === "leaves"
                ? "text-primary-600"
                : "text-slate-400 hover:text-slate-600",
            )}
          >
            <List size={24} className="mb-1" />
            <span className="text-[10px] font-medium">Leaves</span>
          </button>

          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab("approvals")}
                className={cn(
                  "flex flex-col items-center pb-4 w-16 transition-colors relative",
                  activeTab === "approvals"
                    ? "text-primary-600"
                    : "text-slate-400 hover:text-slate-600",
                )}
              >
                <CheckSquare size={24} className="mb-1" />
                <span className="text-[10px] font-medium">Verify</span>
                {leaves.some((l) => l.status === "pending") && (
                  <span className="absolute top-0 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("admin")}
                className={cn(
                  "flex flex-col items-center pb-4 w-16 transition-colors",
                  activeTab === "admin"
                    ? "text-primary-600"
                    : "text-slate-400 hover:text-slate-600",
                )}
              >
                <Shield size={24} className="mb-1" />
                <span className="text-[10px] font-medium">Admin</span>
              </button>
            </>
          )}

          <button
            onClick={() => setActiveTab("reports")}
            className={cn(
              "flex flex-col items-center pb-4 w-16 transition-colors",
              activeTab === "reports"
                ? "text-primary-600"
                : "text-slate-400 hover:text-slate-600",
            )}
          >
            <BarChart2 size={24} className="mb-1" />
            <span className="text-[10px] font-medium">Reports</span>
          </button>
        </nav>
      )}
    </div>
  );
}

export default App;

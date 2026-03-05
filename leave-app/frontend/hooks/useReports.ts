import { Leave, LeaveType, LeaveStatus, UserInfo, Allowances } from "../types";
import { useMemo, useState } from "react";
import { useBridge } from "./useBridge";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const calculateStats = (leaves: Leave[]) => {
  const initial = {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    byType: { sick: 0, annual: 0, casual: 0 } as Record<LeaveType, number>,
    byMonth: {} as Record<string, number>,
    byUser: {} as Record<
      string,
      {
        email: string;
        id: string;
        count: number;
        totalDays: number;
        breakdownDays: Record<LeaveType, number>;
        statusCounts: Record<LeaveStatus, number>;
      }
    >,
  };

  return leaves.reduce((acc, leave) => {
    const start = new Date(`${leave.startDate}T00:00:00`);
    const end = new Date(`${leave.endDate}T00:00:00`);
    const days =
      Math.ceil(
        Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

    acc.total++;
    acc[leave.status]++;

    if (acc.byType[leave.type] !== undefined) {
      acc.byType[leave.type]++;
    }

    const month = new Date(leave.startDate).toLocaleString("default", {
      month: "short",
      year: "2-digit",
    });
    acc.byMonth[month] = (acc.byMonth[month] || 0) + 1;

    if (!acc.byUser[leave.userId]) {
      acc.byUser[leave.userId] = {
        email: leave.userEmail,
        id: leave.userId,
        count: 0,
        totalDays: 0,
        breakdownDays: { sick: 0, annual: 0, casual: 0 },
        statusCounts: { pending: 0, approved: 0, rejected: 0 },
      };
    }

    const userStats = acc.byUser[leave.userId];
    userStats.count++;
    userStats.totalDays += days;

    if (userStats.breakdownDays[leave.type] !== undefined) {
      userStats.breakdownDays[leave.type] += days;
    }

    if (userStats.statusCounts[leave.status] !== undefined) {
      userStats.statusCounts[leave.status]++;
    }

    return acc;
  }, initial);
};

export const generateCSV = (leaves: Leave[]) => {
  const headers = ["Email", "Type", "Start", "End", "Status", "Days", "Reason"];
  const rows = leaves.map((l) => {
    const start = new Date(`${l.startDate}T00:00:00`);
    const end = new Date(`${l.endDate}T00:00:00`);
    const days =
      Math.ceil(
        Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
    return [
      l.userEmail,
      l.type,
      l.startDate,
      l.endDate,
      l.status,
      days,
      `"${l.reason}"`,
    ].join(",");
  });
  return (
    "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n")
  );
};

export const useReports = (params: {
  allLeaves: Leave[];
  currentUser: UserInfo;
  isAdmin: boolean;
  users?: UserInfo[];
}) => {
  const { allLeaves, currentUser, isAdmin, users } =
    params;
  const [activeTab, setActiveTab] = useState<"my" | "org">(
    isAdmin ? "org" : "my"
  );
  const [orgSubTab, setOrgSubTab] = useState<"overview" | "raw">("overview");
  
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [typeFilter, setTypeFilter] = useState<
    "sick" | "annual" | "casual" | "all"
  >("all");
  const [statusFilter, setStatusFilter] = useState<
    "pending" | "approved" | "rejected" | "all"
  >("all");

  const sourceLeaves = useMemo(() => {
    if (activeTab === "my") {
      return allLeaves.filter((l) => l.userId === currentUser.id);
    }
    return allLeaves;
  }, [activeTab, allLeaves, currentUser]);

  const filteredLeaves = useMemo(() => {
    return sourceLeaves.filter((l) => {
      if (startDate && l.startDate < startDate) return false;
      if (endDate && l.startDate > endDate) return false;
      if (typeFilter !== "all" && l.type !== typeFilter) return false;
      if (statusFilter !== "all" && l.status !== statusFilter) return false;

      if (search) {
        const term = search.toLowerCase();
        if (activeTab === "my") {
          return l.reason.toLowerCase().includes(term);
        } else {
          return (
            l.userEmail.toLowerCase().includes(term) ||
            l.reason.toLowerCase().includes(term)
          );
        }
      }
      return true;
    });
  }, [
    sourceLeaves,
    search,
    startDate,
    endDate,
    typeFilter,
    statusFilter,
    activeTab,
  ]);

  const stats = useMemo(() => calculateStats(filteredLeaves), [filteredLeaves]);

  const { requestDownloadFile } = useBridge();

  const handleDownloadCSV = async () => {
    const uri = generateCSV(filteredLeaves);
    const filename = `report_${activeTab}_${
      new Date().toISOString().split("T")[0]
    }.csv`;

    // If we are in the host bridge environment, send base64 payload
    if (typeof requestDownloadFile === "function") {
      const csvText = uri.includes(",") ? uri.slice(uri.indexOf(",") + 1) : uri;
      const base64 = btoa(unescape(encodeURIComponent(csvText)));
      try {
        await requestDownloadFile({ base64, filename });
      } catch (err) {
        console.error(
          "Bridge download failed, falling back to browser download",
          err
        );
      }
    }
  };

  const handlePrint = async (filtered: Leave[], tab: string) => {
    try {
      const filename = `report_${tab}_${
        new Date().toISOString().split("T")[0]
      }.pdf`;

      // Create a new jsPDF instance
      const doc = new jsPDF("p", "mm", "a4");

      // Add a title
      doc.setFontSize(16);
      doc.text(`Report (${tab})`, 14, 20);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

      // Prepare table data
      const tableBody = filtered.map((l) => [
        l.userEmail,
        l.type,
        l.startDate,
        l.endDate,
        l.status,
        Math.ceil(
          (new Date(`${l.endDate}T00:00:00`).getTime() - new Date(`${l.startDate}T00:00:00`).getTime()) /
            (1000 * 60 * 60 * 24) +
            1
        ),
        l.reason,
      ]);

      // Generate table using AutoTable
      autoTable(doc, {
        startY: 35,
        head: [["Email", "Type", "Start", "End", "Status", "Days", "Reason"]],
        body: tableBody,
        theme: "grid",
        headStyles: {
          fillColor: [243, 244, 246],
          textColor: 30,
          fontStyle: "bold",
        },
        styles: {
          font: "helvetica",
          fontSize: 10,
          cellPadding: 3,
        },
        didDrawPage: (data) => {
          // Optional: page number footer
          const pageCount = doc.getNumberOfPages();
          doc.setFontSize(8);
          doc.text(
            `Page ${doc.getCurrentPageInfo().pageNumber} of ${pageCount}`,
            data.settings.margin.left,
            doc.internal.pageSize.getHeight() - 10
          );
        },
      });

      // Convert PDF to base64 for download via bridge (if needed)
      const arrayBuffer = doc.output("arraybuffer");
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      await requestDownloadFile({ base64, filename });
    } catch (err) {
      console.error("PDF generation failed:", err);
    }
  };

  const typeData = Object.keys(stats.byType)
    .map((key) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value: stats.byType[key as LeaveType],
    }))
    .filter((d) => d.value > 0);

  return {
    activeTab,
    setActiveTab,
    orgSubTab,
    setOrgSubTab,
    search,
    setSearch,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    sourceLeaves,
    filteredLeaves,
    stats,
    typeData,
    requestDownloadFile,
    handleDownloadCSV,
    handlePrint,
    calculateStats,
    generateCSV,
  };
};


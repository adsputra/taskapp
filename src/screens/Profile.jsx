"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userApi } from "@/lib/api/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  Settings,
  Activity,
  Mail,
  Calendar,
  Edit3,
  Save,
  X,
  Lock,
  Eye,
  EyeOff,
  Bell,
  BellOff,
  Folder,
  Clock,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";

const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "activity", label: "Activity", icon: Activity },
];

export default function Profile() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("profile");

  const { data: user, isLoading } = useQuery({
    queryKey: ["user"],
    queryFn: () => userApi.me(),
    staleTime: 0,
  });

  return (
    <div className="min-h-screen bg-slate-50/80 dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">

        {/* ── Header Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden"
        >
          {/* Cover gradient */}
          <div className="h-24 sm:h-32 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 relative">
            <div className="absolute inset-0 bg-black/10" />
          </div>

          {/* Avatar + Info */}
          <div className="px-6 pb-6 -mt-12 sm:-mt-14 relative">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              {/* Avatar */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-blue-600 border-4 border-white dark:border-slate-900 shadow-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-3xl sm:text-4xl select-none">
                  {isLoading
                    ? "…"
                    : user?.full_name?.charAt(0)?.toUpperCase() ||
                      user?.email?.charAt(0)?.toUpperCase() ||
                      "U"}
                </span>
              </div>

              {/* Name + meta */}
              <div className="flex-1 pb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {isLoading ? "Loading…" : user?.full_name || "Guest"}
                </h1>
                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                  <span className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                    <Mail className="w-3.5 h-3.5" />
                    {user?.email || "—"}
                  </span>
                  {user?.created_at && (
                    <span className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      Joined{" "}
                      {new Date(user.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Tabs ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800"
        >
          {/* Tab nav */}
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-all relative
                    ${
                      active
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {active && (
                    <motion.div
                      layoutId="profileTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="p-5 sm:p-6">
            <AnimatePresence mode="wait">
              {activeTab === "profile" && (
                <ProfileTab key="profile" user={user} isLoading={isLoading} />
              )}
              {activeTab === "settings" && (
                <SettingsTab key="settings" user={user} />
              )}
              {activeTab === "activity" && (
                <ActivityTab key="activity" user={user} />
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   PROFILE TAB
   ════════════════════════════════════════════════ */
function ProfileTab({ user, isLoading }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  const updateMutation = useMutation({
    mutationFn: (updates) => userApi.updateProfile(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      setEditing(false);
      toast.success("Profile updated!");
    },
    onError: (err) => toast.error(err.message || "Failed to update profile"),
  });

  const startEdit = () => {
    setName(user?.full_name || "");
    setEditing(true);
  };

  const handleSave = () => {
    if (!name.trim()) return toast.error("Name cannot be empty");
    updateMutation.mutate({ full_name: name.trim() });
  };

  if (isLoading) return <Skeleton />;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Full Name */}
      <div className="space-y-2">
        <Label className="text-slate-600 dark:text-slate-400 font-medium text-xs uppercase tracking-wide">
          Full Name
        </Label>
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="flex-1 h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-blue-500/20 focus:border-blue-400"
              autoFocus
            />
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-4"
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setEditing(false)}
              className="rounded-xl h-11 px-4 border-slate-200 dark:border-slate-700"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-700">
            <span className="text-slate-800 dark:text-slate-100 font-medium">
              {user?.full_name || "—"}
            </span>
            <button
              onClick={startEdit}
              className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Email (read-only) */}
      <div className="space-y-2">
        <Label className="text-slate-600 dark:text-slate-400 font-medium text-xs uppercase tracking-wide">
          Email Address
        </Label>
        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-700">
          <Mail className="w-4 h-4 text-slate-400" />
          <span className="text-slate-800 dark:text-slate-100 font-medium">
            {user?.email || "—"}
          </span>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 pl-1">
          Email cannot be changed
        </p>
      </div>

      {/* Member since */}
      {user?.created_at && (
        <div className="space-y-2">
          <Label className="text-slate-600 dark:text-slate-400 font-medium text-xs uppercase tracking-wide">
            Member Since
          </Label>
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-700">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-slate-800 dark:text-slate-100 font-medium">
              {new Date(user.created_at).toLocaleDateString("en-US", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ════════════════════════════════════════════════
   SETTINGS TAB
   ════════════════════════════════════════════════ */
function SettingsTab({ user }) {
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const changePwMutation = useMutation({
    mutationFn: () => userApi.changePassword(currentPw, newPw),
    onSuccess: () => {
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      toast.success("Password changed successfully!");
    },
    onError: (err) => toast.error(err.message || "Failed to change password"),
  });

  const handleChangePassword = () => {
    if (!currentPw || !newPw) return toast.error("Please fill in all fields");
    if (newPw.length < 6) return toast.error("Password must be at least 6 characters");
    if (newPw !== confirmPw) return toast.error("Passwords do not match");
    changePwMutation.mutate();
  };

  const togglePwVisibility = (field) =>
    setShowPasswords((p) => ({ ...p, [field]: !p[field] }));

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.2 }}
      className="space-y-8"
    >
      {/* Change Password */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Change Password
          </h3>
        </div>

        {/* Current Password */}
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Current Password
          </Label>
          <div className="relative">
            <Input
              type={showPasswords.current ? "text" : "password"}
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-11 focus:ring-blue-500/20 focus:border-blue-400"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => togglePwVisibility("current")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {showPasswords.current ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            New Password
          </Label>
          <div className="relative">
            <Input
              type={showPasswords.new ? "text" : "password"}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-11 focus:ring-blue-500/20 focus:border-blue-400"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => togglePwVisibility("new")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {showPasswords.new ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Confirm New Password */}
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Confirm New Password
          </Label>
          <div className="relative">
            <Input
              type={showPasswords.confirm ? "text" : "password"}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-11 focus:ring-blue-500/20 focus:border-blue-400"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => togglePwVisibility("confirm")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {showPasswords.confirm ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <Button
          onClick={handleChangePassword}
          disabled={changePwMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-6 font-medium"
        >
          {changePwMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving…
            </>
          ) : (
            "Change Password"
          )}
        </Button>
      </div>

      {/* Notification preferences */}
      <div className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-6">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Notifications
          </h3>
        </div>

        <div className="space-y-3">
          {[
            { label: "Email notifications", desc: "Get updates via email", defaultChecked: true },
            { label: "Push notifications", desc: "Browser push alerts", defaultChecked: false },
          ].map((pref) => (
            <div
              key={pref.label}
              className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-700"
            >
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {pref.label}
                </p>
                <p className="text-xs text-slate-400">{pref.desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked={pref.defaultChecked}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 dark:bg-slate-600 rounded-full peer-checked:bg-blue-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-4" />
              </label>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════
   ACTIVITY TAB
   ════════════════════════════════════════════════ */
function ActivityTab({ user }) {
  const { data: boards = [], isLoading } = useQuery({
    queryKey: ["profile-boards"],
    queryFn: () => userApi.getRecentBoards(20),
  });

  const timeSince = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Your Boards
        </h3>
        <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
          {boards.length} board{boards.length !== 1 ? "s" : ""}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <div className="text-center py-12">
          <Folder className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            No boards yet
          </p>
          <Link
            href="/boards"
            className="text-blue-600 dark:text-blue-400 text-sm font-medium mt-2 inline-block hover:underline"
          >
            Create your first board →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {boards.map((board) => (
            <Link
              key={board.id}
              href={`/boards/${board.id}`}
              className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-700 transition-colors group"
            >
              {/* Board color dot */}
              <div
                className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
                style={{ backgroundColor: board.color + "20" }}
              >
                <Folder
                  className="w-4 h-4"
                  style={{ color: board.color }}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                  {board.title}
                </p>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Updated {timeSince(board.updated_at)}
                </p>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ── Skeleton ── */
function Skeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
        </div>
      ))}
    </div>
  );
}

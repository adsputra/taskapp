"use client";

import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { attachmentsApi } from "@/lib/api/attachments";
import { toast } from "sonner";
import { Upload, FileText, Image, Film, File, Trash2, Download, X } from "lucide-react";

const getFileIcon = (type) => {
  if (type?.startsWith("image/")) return Image;
  if (type?.startsWith("video/")) return Film;
  return FileText;
};

const formatFileSize = (bytes) => {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export default function FilesTab({ task, boardId, userRole }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();
  const isViewer = userRole === "viewer";

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["attachments", task?.id],
    queryFn: () => attachmentsApi.listByItem(task.id),
    enabled: !!task?.id,
  });

  const uploadFile = useMutation({
    mutationFn: (file) => attachmentsApi.upload({ item_id: task.id, board_id: boardId, file }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attachments", task.id] });
      toast.success("File uploaded");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteFile = useMutation({
    mutationFn: (id) => attachmentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attachments", task.id] });
      toast.success("File deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFiles = (files) => {
    Array.from(files).forEach((file) => {
      uploadFile.mutate(file);
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  return (
    <div className="p-6">
      {/* Upload Area */}
      {!isViewer && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors mb-6 ${
            isDragging
              ? "border-[#0073EA] bg-[#0073EA]/5"
              : "border-[#E1E5F3] hover:border-[#0073EA] hover:bg-[#F5F6F8]"
          }`}
        >
          <Upload className={`w-8 h-8 mx-auto mb-2 ${isDragging ? "text-[#0073EA]" : "text-[#A0A0A0]"}`} />
          <p className="text-sm text-[#323338] font-medium">
            {uploadFile.isPending ? "Uploading..." : "Drop files here or click to upload"}
          </p>
          <p className="text-xs text-[#A0A0A0] mt-1">Any file type supported</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
          />
        </div>
      )}

      {/* File List */}
      {attachments.length === 0 && !isLoading && (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-[#F5F6F8] flex items-center justify-center mx-auto mb-3">
            <File className="w-5 h-5 text-[#A0A0A0]" />
          </div>
          <p className="text-sm text-[#676879]">No files attached</p>
          <p className="text-xs text-[#A0A0A0] mt-1">Upload files to share with your team</p>
        </div>
      )}

      <div className="space-y-2">
        {attachments.map((att) => {
          const Icon = getFileIcon(att.file_type);
          const isImage = att.file_type?.startsWith("image/");
          const userName = att.profiles?.full_name || att.user_id?.slice(0, 8);

          return (
            <div
              key={att.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-[#E1E5F3] hover:bg-[#F5F6F8] group transition-colors"
            >
              {/* Thumbnail or Icon */}
              {isImage ? (
                <img
                  src={att.file_url}
                  alt={att.file_name}
                  className="w-10 h-10 rounded object-cover shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded bg-[#F5F6F8] flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-[#676879]" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <a
                  href={att.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[#323338] hover:text-[#0073EA] truncate block"
                >
                  {att.file_name}
                </a>
                <p className="text-[10px] text-[#A0A0A0]">
                  {formatFileSize(att.file_size)} · {userName} · {new Date(att.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <a
                  href={att.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-[#A0A0A0] hover:text-[#0073EA] rounded"
                  title="Download"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
                {!isViewer && (
                  <button
                    onClick={() => {
                      if (window.confirm("Delete this file?")) {
                        deleteFile.mutate(att.id);
                      }
                    }}
                    className="p-1.5 text-[#A0A0A0] hover:text-red-500 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

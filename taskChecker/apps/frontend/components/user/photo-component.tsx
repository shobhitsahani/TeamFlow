"use client";

/* PhotoComponent — interactive photo avatar manager & uploader for TeamFlow.
   Allows uploading photos via drag-and-drop or file picker, zoom/crop preview,
   preset curated avatar selection, and smooth Framer Motion spring physics. */

import { useState, useRef, useCallback, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "@/components/motion";
import { UserAvatar } from "./user-avatar";
import { Button } from "@/components/ui/button";
import { IconX, IconCheck, IconTrash } from "@/components/icons";

export interface PhotoComponentProps {
  /** Current photo URL (null or undefined if none) */
  currentPhotoUrl?: string | null;
  /** User or entity display name */
  name: string;
  /** Callback when a new photo (URL or base64 data URI) is selected and saved */
  onSavePhoto?: (photoUrl: string | null) => void | Promise<void>;
  /** Optional custom trigger button rendering */
  trigger?: (open: () => void) => React.ReactNode;
  /** Size of the preview avatar in the modal */
  previewSize?: "lg" | "xl" | "2xl";
  /** Optional modal title */
  title?: string;
  /** Close callback */
  onClose?: () => void;
}

const PRESET_AVATARS = [
  { id: "grad-purple", label: "Harbor Purple", url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=256&auto=format&fit=crop&q=80" },
  { id: "grad-cyan", label: "Oceanic Cyan", url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=256&auto=format&fit=crop&q=80" },
  { id: "grad-amber", label: "Amber Glow", url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=256&auto=format&fit=crop&q=80" },
  { id: "grad-emerald", label: "Emerald Bay", url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=256&auto=format&fit=crop&q=80" },
  { id: "grad-indigo", label: "Deep Indigo", url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=256&auto=format&fit=crop&q=80" },
  { id: "grad-rose", label: "Sunset Rose", url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=256&auto=format&fit=crop&q=80" },
];

export function PhotoComponent({
  currentPhotoUrl,
  name,
  onSavePhoto,
  trigger,
  title = "Update profile photo",
}: PhotoComponentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(currentPhotoUrl ?? null);
  const [activeTab, setActiveTab] = useState<"upload" | "presets">("upload");
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openModal = useCallback(() => {
    setSelectedPhoto(currentPhotoUrl ?? null);
    setZoom(1);
    setIsOpen(true);
  }, [currentPhotoUrl]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleFileChange = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === "string") {
        setSelectedPhoto(e.target.result);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileChange(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileChange(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (onSavePhoto) {
        await onSavePhoto(selectedPhoto);
      }
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = () => {
    setSelectedPhoto(null);
  };

  return (
    <>
      {trigger ? (
        trigger(openModal)
      ) : (
        <UserAvatar
          name={name}
          src={currentPhotoUrl}
          size="default"
          editable
          onPhotoClick={openModal}
        />
      )}

      <AnimatePresence>
        {isOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            {/* Scrim backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeModal}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              aria-hidden="true"
            />

            {/* Modal Card */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0f141c] p-6 shadow-2xl text-slate-100"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/8">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-white">{title}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Custom photo or curated avatar for your profile</p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close"
                >
                  <IconX size={16} />
                </button>
              </div>

              {/* Central Avatar Preview */}
              <div className="flex flex-col items-center justify-center py-6">
                <div className="relative group">
                  <div
                    className="relative overflow-hidden rounded-full ring-4 ring-primary/20 shadow-xl transition-all"
                    style={{
                      width: 100,
                      height: 100,
                    }}
                  >
                    {selectedPhoto ? (
                      <img
                        src={selectedPhoto}
                        alt="Preview"
                        className="w-full h-full object-cover transition-transform duration-150"
                        style={{ transform: `scale(${zoom})` }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-700 text-white font-bold text-2xl">
                        {name.slice(0, 2).toUpperCase() || "TF"}
                      </div>
                    )}
                  </div>

                  {selectedPhoto ? (
                    <button
                      type="button"
                      onClick={handleRemove}
                      title="Remove photo"
                      className="absolute -top-1 -right-1 rounded-full bg-red-600/90 text-white p-1 shadow-md hover:bg-red-500 transition-colors"
                    >
                      <IconTrash size={13} />
                    </button>
                  ) : null}
                </div>

                {/* Zoom control when custom photo is active */}
                {selectedPhoto ? (
                  <div className="mt-4 flex items-center gap-3 w-48 text-xs text-slate-400">
                    <span>Zoom</span>
                    <input
                      type="range"
                      min="1"
                      max="2"
                      step="0.05"
                      value={zoom}
                      onChange={(e) => setZoom(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <span>{Math.round(zoom * 100)}%</span>
                  </div>
                ) : null}
              </div>

              {/* Navigation Tabs */}
              <div className="flex rounded-xl bg-white/5 p-1 mb-4 border border-white/5">
                <button
                  type="button"
                  onClick={() => setActiveTab("upload")}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    activeTab === "upload"
                      ? "bg-primary text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("presets")}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    activeTab === "presets"
                      ? "bg-primary text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Choose Preset
                </button>
              </div>

              {/* Tab 1: Upload Dropzone */}
              {activeTab === "upload" ? (
                <div
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                    isDragging
                      ? "border-primary bg-primary/10"
                      : "border-white/10 hover:border-white/20 bg-white/[0.02]"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onFileInputChange}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded-full bg-white/5 p-2 text-primary">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-slate-200">
                      Click to upload or drag & drop
                    </span>
                    <span className="text-[11px] text-slate-400">
                      PNG, JPG, WebP or GIF up to 5MB
                    </span>
                  </div>
                </div>
              ) : (
                /* Tab 2: Preset Avatars */
                <div className="grid grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
                  {PRESET_AVATARS.map((preset) => {
                    const isSelected = selectedPhoto === preset.url;
                    return (
                      <motion.button
                        key={preset.id}
                        type="button"
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setSelectedPhoto(preset.url)}
                        className={`relative rounded-xl overflow-hidden p-1 border transition-all text-left flex flex-col items-center gap-1.5 ${
                          isSelected
                            ? "border-primary bg-primary/15 ring-2 ring-primary/40"
                            : "border-white/10 bg-white/5 hover:border-white/20"
                        }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.label}
                          className="size-12 rounded-full object-cover shadow"
                        />
                        <span className="text-[10px] text-slate-300 font-medium truncate w-full text-center">
                          {preset.label}
                        </span>
                        {isSelected ? (
                          <span className="absolute top-1.5 right-1.5 rounded-full bg-primary p-0.5 text-white">
                            <IconCheck size={10} />
                          </span>
                        ) : null}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* Footer Actions */}
              <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-white/8">
                <Button variant="ghost" size="sm" onClick={closeModal} disabled={saving}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} loading={saving}>
                  Save changes
                </Button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

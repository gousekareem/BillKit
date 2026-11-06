/* Camera capture and crop dialogs. © 2026 Shaik Gouse Kareem. All rights reserved. */
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Camera } from 'lucide-react';
import { Dialog } from './Dialog';
import { captureFrame, cropFile } from '../utils/image';

export function CameraDialog({ open, onClose, onCapture }: { open: boolean; onClose: () => void; onCapture: (f: File) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    setError(null);
    setReady(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot open the camera here. Camera access needs HTTPS (or localhost). Use “Choose files” instead.');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1920 } }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play().then(() => setReady(true));
        }
      })
      .catch((e: DOMException) => {
        setError(
          e.name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access in your browser settings, or upload a photo instead.'
            : e.name === 'NotFoundError'
              ? 'No camera was found on this device.'
              : 'The camera could not be started. Upload a photo instead.',
        );
      });
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [open]);
  return (
    <Dialog
      open={open}
      title="Capture a bill"
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!ready}
            onClick={async () => {
              if (!video.current) return;
              onCapture(await captureFrame(video.current));
              onClose();
            }}
          >
            <Camera size={18} aria-hidden /> Take photo
          </button>
        </>
      }
    >
      {error ? <div className="alert alert-error" role="alert">{error}</div> : <video ref={video} className="camera-video" playsInline muted aria-label="Camera preview" />}
      <p className="subtle" style={{ marginTop: 8 }}>Tip: fill the frame with the bill, avoid shadows and glare, and keep the total visible.</p>
    </Dialog>
  );
}

type Rect = { x: number; y: number; w: number; h: number };

export function CropDialog({ file, onClose, onDone }: { file: File | null; onClose: () => void; onDone: (f: File) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [rect, setRect] = useState<Rect>({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: 'move' | 'tl' | 'tr' | 'bl' | 'br'; sx: number; sy: number; start: Rect } | null>(null);
  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    setRect({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
    return () => URL.revokeObjectURL(u);
  }, [file]);
  const begin = (mode: NonNullable<typeof drag.current>['mode']) => (e: RPointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start: rect };
  };
  const move = (e: RPointerEvent) => {
    const d = drag.current;
    const box = stage.current?.getBoundingClientRect();
    if (!d || !box) return;
    const dx = (e.clientX - d.sx) / box.width;
    const dy = (e.clientY - d.sy) / box.height;
    const s = d.start;
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    let r: Rect = { ...s };
    if (d.mode === 'move') r = { ...s, x: clamp(Math.min(s.x + dx, 1 - s.w)), y: clamp(Math.min(s.y + dy, 1 - s.h)) };
    if (d.mode === 'tl') r = { x: clamp(s.x + dx), y: clamp(s.y + dy), w: s.w - dx, h: s.h - dy };
    if (d.mode === 'tr') r = { x: s.x, y: clamp(s.y + dy), w: s.w + dx, h: s.h - dy };
    if (d.mode === 'bl') r = { x: clamp(s.x + dx), y: s.y, w: s.w - dx, h: s.h + dy };
    if (d.mode === 'br') r = { ...s, w: s.w + dx, h: s.h + dy };
    if (r.w > 0.08 && r.h > 0.08 && r.x + r.w <= 1.001 && r.y + r.h <= 1.001) setRect(r);
  };
  const nudge = (k: string) => {
    const step = 0.02;
    if (k === 'ArrowLeft') setRect((r) => ({ ...r, x: Math.max(0, r.x - step) }));
    if (k === 'ArrowRight') setRect((r) => ({ ...r, x: Math.min(1 - r.w, r.x + step) }));
    if (k === 'ArrowUp') setRect((r) => ({ ...r, y: Math.max(0, r.y - step) }));
    if (k === 'ArrowDown') setRect((r) => ({ ...r, y: Math.min(1 - r.h, r.y + step) }));
  };
  return (
    <Dialog
      open={Boolean(file)}
      title="Crop the bill"
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={async () => file && onDone(await cropFile(file, rect))}>Apply crop</button>
        </>
      }
    >
      <p className="subtle">Drag the frame or its corners. Arrow keys move the frame. Automatic perspective correction also runs on the server.</p>
      {url && (
        <div className="crop-stage" ref={stage} onPointerMove={move} onPointerUp={() => (drag.current = null)}>
          <img src={url} alt="Bill to crop" draggable={false} />
          <div
            className="crop-rect"
            role="slider"
            tabIndex={0}
            aria-label="Crop area"
            aria-valuetext={`x ${Math.round(rect.x * 100)}%, y ${Math.round(rect.y * 100)}%, width ${Math.round(rect.w * 100)}%, height ${Math.round(rect.h * 100)}%`}
            onKeyDown={(e) => nudge(e.key)}
            style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}
            onPointerDown={begin('move')}
          >
            {(['tl', 'tr', 'bl', 'br'] as const).map((h) => (
              <span key={h} className="crop-handle" onPointerDown={begin(h)} style={{ left: h.includes('l') ? 0 : '100%', top: h.includes('t') ? 0 : '100%' }} />
            ))}
          </div>
        </div>
      )}
    </Dialog>
  );
}

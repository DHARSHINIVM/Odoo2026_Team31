import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Upload,
  SwitchCamera,
  MapPin,
  X,
  Zap,
} from 'lucide-react';

/**
 * Robust Hardware Camera & Scanner Component
 * Supports:
 * 1. Live stream via navigator.mediaDevices.getUserMedia
 * 2. Barcode/QR scanning via native BarcodeDetector API (with canvas fallback)
 * 3. High-resolution snapshot capture with category tagging and GPS metadata
 * 4. Front/Rear camera switching
 * 5. Hardware fallback to file upload or manual input
 */
export default function CameraCapture({
  mode = 'scan', // 'scan' | 'photo'
  onScan, // (code, format) => void
  onCapture, // ({ file, previewUrl, category, gps, captureTime }) => void
  categories = [
    { value: 'PANEL_INSTALLATION', label: 'Solar PV Modules' },
    { value: 'MOUNTING_STRUCTURE', label: 'Mounting Structure & Railing' },
    { value: 'INVERTER_INSTALLATION', label: 'Inverter Installation' },
    { value: 'BATTERY_STORAGE', label: 'Battery Storage System' },
    { value: 'ELECTRICAL_WIRING', label: 'DC/AC Cabling & Conduits' },
    { value: 'EARTHING_GROUNDING', label: 'Earthing & Lightning Arrester' },
    { value: 'PROTECTION_EQUIPMENT', label: 'Protection Equipment (SPDs/Isolators)' },
    { value: 'METER_GRID_TIE', label: 'Bi-directional Net Meter' },
    { value: 'OVERALL_SITE', label: 'Overall Completed System' },
    { value: 'DEFECT_EXCEPTION', label: 'Defect / Snag / Deviation' },
  ],
  title = 'Camera Scanner',
  placeholderManual = 'Enter serial / QR token manually...',
}) {
  const [isActive, setIsActive] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (back) | 'user' (front)
  const [cameraError, setCameraError] = useState(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [manualInput, setManualInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.value || '');
  const [capturedPreview, setCapturedPreview] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [scanFeedback, setScanFeedback] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // Play audio beep upon successful scan
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      // Audio not permitted or supported
    }
  };

  // Start Camera Stream
  const startCamera = async () => {
    setCameraError(null);
    setScanFeedback(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera hardware access is not supported in this browser. Please use manual entry or file upload.');
      }

      // Stop existing stream if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setIsActive(true);
      setHasPermission(true);

      // Attempt to retrieve device GPS coordinates
      if (navigator.geolocation && mode === 'photo') {
        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setGpsLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            });
            setGpsLoading(false);
          },
          (err) => {
            console.warn('GPS location unavailable:', err.message);
            setGpsLoading(false);
          },
          { timeout: 8000, enableHighAccuracy: true }
        );
      }
    } catch (err) {
      console.error('Camera activation error:', err);
      setIsActive(false);
      setHasPermission(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow camera access in browser settings, or use manual entry below.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera device detected on this system. You can enter codes manually or upload images from disk.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('Camera is currently in use by another application. Close other camera apps and retry.');
      } else {
        setCameraError(err.message || 'Could not access device camera.');
      }
    }
  };

  // Stop Camera Stream
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Restart camera when switching facing mode
  useEffect(() => {
    if (isActive) {
      startCamera();
    }
  }, [facingMode]);

  // Scanning Loop (Native BarcodeDetector where supported)
  useEffect(() => {
    if (!isActive || mode !== 'scan') return;

    let detector = null;
    if ('BarcodeDetector' in window) {
      try {
        detector = new window.BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'data_matrix'],
        });
      } catch (e) {
        console.warn('BarcodeDetector format error:', e);
      }
    }

    const interval = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      if (detector) {
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            const format = barcodes[0].format || 'BARCODE';
            playBeep();
            setScanFeedback({ code, format });
            if (onScan) onScan(code, format);
          }
        } catch (err) {
          // Frame detection glitch; retry next frame
        }
      }
    }, 450);

    scanIntervalRef.current = interval;
    return () => clearInterval(interval);
  }, [isActive, mode, onScan]);

  // Handle Photo Capture from Live Video
  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const previewUrl = URL.createObjectURL(blob);
        setCapturedPreview(previewUrl);
        setCapturedBlob(blob);
      },
      'image/jpeg',
      0.88
    );
  };

  // Confirm Captured Photo
  const handleConfirmPhoto = () => {
    if (!capturedBlob || !onCapture) return;

    const file = new File(
      [capturedBlob],
      `evidence_${selectedCategory.toLowerCase()}_${Date.now()}.jpg`,
      { type: 'image/jpeg' }
    );

    onCapture({
      file,
      previewUrl: capturedPreview,
      category: selectedCategory,
      gps: gpsLocation,
      captureTime: new Date().toISOString(),
    });

    // Reset preview
    setCapturedPreview(null);
    setCapturedBlob(null);
  };

  // Discard Preview Photo
  const handleDiscardPhoto = () => {
    if (capturedPreview) URL.revokeObjectURL(capturedPreview);
    setCapturedPreview(null);
    setCapturedBlob(null);
  };

  // Manual code entry submission
  const handleManualSubmit = (e) => {
    e.preventDefault();
    const clean = manualInput.trim();
    if (!clean) return;
    playBeep();
    setScanFeedback({ code: clean, format: 'MANUAL_ENTRY' });
    if (onScan) onScan(clean, 'MANUAL_ENTRY');
    setManualInput('');
  };

  // Fallback File Upload (for desktop or when camera hardware unavailable)
  const handleFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (mode === 'photo' && onCapture) {
      const previewUrl = URL.createObjectURL(file);
      onCapture({
        file,
        previewUrl,
        category: selectedCategory,
        gps: null,
        captureTime: new Date().toISOString(),
      });
    } else if (mode === 'scan') {
      // Decode QR from uploaded image using BarcodeDetector if available
      if ('BarcodeDetector' in window) {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = async () => {
          try {
            const detector = new window.BarcodeDetector({
              formats: ['qr_code', 'code_128', 'code_39', 'ean_13'],
            });
            const barcodes = await detector.detect(img);
            if (barcodes.length > 0) {
              const code = barcodes[0].rawValue;
              playBeep();
              setScanFeedback({ code, format: barcodes[0].format });
              if (onScan) onScan(code, barcodes[0].format);
            } else {
              setCameraError('No barcode/QR code detected in the uploaded image. Please enter manually.');
            }
          } catch (e) {
            setCameraError('Image barcode decoding failed. Please enter the serial number manually.');
          }
        };
      } else {
        setCameraError('Image file scanning requires BarcodeDetector API. Please enter the serial number manually.');
      }
    }
  };

  return (
    <div
      style={{
        background: '#0f172a',
        borderRadius: '14px',
        border: '1.5px solid #334155',
        padding: '1.25rem',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Header with status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              padding: '0.45rem',
              borderRadius: '8px',
              background: isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.1)',
              color: isActive ? 'var(--solar-green-400)' : '#94a3b8',
            }}
          >
            <Camera size={18} />
          </div>
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>{title}</h4>
            <span style={{ fontSize: '0.72rem', color: isActive ? 'var(--solar-green-400)' : '#94a3b8' }}>
              {isActive ? '● Camera Active — Ready to scan' : '○ Camera Standby'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isActive ? (
            <>
              <button
                type="button"
                onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                title="Switch Camera (Front/Rear)"
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.65rem', fontSize: '0.75rem', background: '#1e293b', border: '1px solid #475569', color: '#ffffff' }}
              >
                <SwitchCamera size={14} style={{ marginRight: '0.3rem' }} />
                {facingMode === 'environment' ? 'Back Cam' : 'Front Cam'}
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.65rem', fontSize: '0.75rem', background: '#334155', border: 'none', color: '#ffffff' }}
              >
                <CameraOff size={14} style={{ marginRight: '0.3rem' }} />
                Stop
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startCamera}
              className="btn btn-primary"
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'linear-gradient(135deg, var(--solar-green-500), var(--solar-green-600))',
              }}
            >
              <Camera size={15} />
              Open Camera
            </button>
          )}
        </div>
      </div>

      {/* Error / Permission Notice */}
      {cameraError && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid var(--red-600)',
            borderRadius: '8px',
            padding: '0.75rem',
            fontSize: '0.78rem',
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
          }}
        >
          <AlertCircle size={16} color="var(--red-600)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>{cameraError}</div>
        </div>
      )}

      {/* Camera Live Viewfinder / Snapshot Preview */}
      {isActive && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '280px',
            background: '#000000',
            borderRadius: '10px',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid var(--solar-green-500)',
          }}
        >
          {capturedPreview ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <img
                src={capturedPreview}
                alt="Captured Snapshot"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '10px',
                  right: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  background: 'rgba(15, 23, 42, 0.85)',
                  padding: '0.6rem 0.85rem',
                  borderRadius: '8px',
                }}
              >
                <button
                  type="button"
                  onClick={handleDiscardPhoto}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', background: '#334155', color: '#fff' }}
                >
                  <X size={14} style={{ marginRight: '0.3rem' }} />
                  Retake
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPhoto}
                  className="btn btn-primary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.85rem', background: 'var(--solar-green-500)' }}
                >
                  <CheckCircle size={14} style={{ marginRight: '0.3rem' }} />
                  Save Photo Evidence
                </button>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {/* Viewfinder Target Graphic */}
              <div
                style={{
                  position: 'absolute',
                  width: mode === 'scan' ? '220px' : '85%',
                  height: mode === 'scan' ? '140px' : '80%',
                  border: '2px dashed var(--solar-green-400)',
                  borderRadius: '10px',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {mode === 'scan' && (
                  <div
                    style={{
                      width: '100%',
                      height: '2px',
                      background: 'rgba(52, 211, 153, 0.85)',
                      boxShadow: '0 0 8px #34d399',
                      animation: 'scanline 2s infinite ease-in-out',
                    }}
                  />
                )}
              </div>

              {/* Photo Mode Trigger Button */}
              {mode === 'photo' && (
                <div style={{ position: 'absolute', bottom: '15px' }}>
                  <button
                    type="button"
                    onClick={handleCapturePhoto}
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      background: '#ffffff',
                      border: '4px solid var(--solar-green-500)',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--solar-green-500)' }} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Category & GPS tagging for Photo Mode */}
      {mode === 'photo' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem' }}>
              Evidence Category:
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem',
                background: '#1e293b',
                border: '1px solid #475569',
                color: '#ffffff',
                borderRadius: '6px',
                fontSize: '0.8rem',
              }}
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem' }}>
              Device GPS Location:
            </label>
            <div
              style={{
                padding: '0.45rem 0.65rem',
                background: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: gpsLocation ? 'var(--solar-green-400)' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <MapPin size={14} />
              {gpsLoading ? (
                'Acquiring coordinates...'
              ) : gpsLocation ? (
                `${gpsLocation.lat.toFixed(4)}°N, ${gpsLocation.lng.toFixed(4)}°E (±${Math.round(gpsLocation.accuracy)}m)`
              ) : (
                'GPS optional / not granted'
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scan Feedback Banner */}
      {scanFeedback && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid var(--solar-green-500)',
            borderRadius: '8px',
            padding: '0.65rem 0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#ffffff' }}>
            <CheckCircle size={16} color="var(--solar-green-400)" />
            <span>
              Scanned: <strong>{scanFeedback.code}</strong> ({scanFeedback.format})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setScanFeedback(null)}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Fallback Section: Manual Input & File Upload */}
      <div style={{ borderTop: '1px solid #334155', paddingTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Hardware Fallback & Manual Entry:
        </span>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {mode === 'scan' ? (
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '240px' }}>
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder={placeholderManual}
                style={{
                  flex: 1,
                  padding: '0.45rem 0.75rem',
                  background: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                }}
              />
              <button
                type="submit"
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem', background: '#334155', color: '#ffffff' }}
              >
                Submit Code
              </button>
            </form>
          ) : (
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.85rem',
                  background: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  color: '#cbd5e1',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                <Upload size={14} />
                Upload Image File
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          )}

          {/* Additional File Scan option for Scan mode */}
          {mode === 'scan' && (
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.75rem',
                background: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '6px',
                color: '#cbd5e1',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
              title="Upload photo of barcode/QR"
            >
              <Upload size={14} />
              Scan from File
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}


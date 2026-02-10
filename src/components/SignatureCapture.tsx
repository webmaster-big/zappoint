import React, { useRef, useState, useEffect, useCallback } from "react";
import SignatureCanvas from "react-signature-canvas";

interface SignatureCaptureProps {
  onSignatureChange: (signatureBase64: string | null) => void;
  required?: boolean;
  error?: string;
}

const SignatureCapture: React.FC<SignatureCaptureProps> = ({
  onSignatureChange,
  required = true,
  error,
}) => {
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  // Stroke history for undo support
  const [strokeHistory, setStrokeHistory] = useState<string[]>([]);

  // --- CANVAS RESIZE (fixes alignment) ---
  const resizeCanvas = useCallback(() => {
    const canvas = sigCanvasRef.current;
    const container = canvasContainerRef.current;
    if (!canvas || !container) return;

    const canvasEl = canvas.getCanvas();
    const rect = container.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);

    // Save current drawing
    const data = canvas.toDataURL();
    const wasEmpty = canvas.isEmpty();

    canvasEl.width = rect.width * ratio;
    canvasEl.height = 200 * ratio;
    canvasEl.style.width = `${rect.width}px`;
    canvasEl.style.height = "200px";

    const ctx = canvasEl.getContext("2d");
    if (ctx) ctx.scale(ratio, ratio);

    // Restore drawing if there was one
    if (!wasEmpty) {
      canvas.fromDataURL(data, { width: rect.width, height: 200 });
    }
  }, []);

  useEffect(() => {
    // Initial resize after mount
    const timer = setTimeout(resizeCanvas, 50);

    const container = canvasContainerRef.current;
    let observer: ResizeObserver | null = null;
    if (container) {
      observer = new ResizeObserver(() => resizeCanvas());
      observer.observe(container);
    }

    return () => {
      clearTimeout(timer);
      observer?.disconnect();
    };
  }, [resizeCanvas]);

  // --- DRAW MODE ---

  const handleDrawEnd = () => {
    if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      // Save snapshot for undo
      const snapshot = sigCanvasRef.current.toDataURL("image/png");
      setStrokeHistory((prev) => [...prev, snapshot]);
      const base64 = sigCanvasRef.current.getTrimmedCanvas().toDataURL("image/png");
      onSignatureChange(base64);
    }
  };

  const handleUndo = () => {
    if (strokeHistory.length === 0) return;

    const canvas = sigCanvasRef.current;
    if (!canvas) return;

    if (strokeHistory.length === 1) {
      // Only one stroke recorded — clear everything
      handleClearDraw();
      return;
    }

    const newHistory = strokeHistory.slice(0, -1);
    setStrokeHistory(newHistory);

    const previousSnapshot = newHistory[newHistory.length - 1];

    // Clear then re-apply scaling before restoring
    canvas.clear();
    resizeCanvas();

    const container = canvasContainerRef.current;
    const width = container ? container.getBoundingClientRect().width : 500;
    canvas.fromDataURL(previousSnapshot, { width, height: 200 });

    // Use the stored snapshot directly — fromDataURL is async so
    // getTrimmedCanvas() would return blank if called immediately
    onSignatureChange(previousSnapshot);
  };

  const handleClearDraw = () => {
    const canvas = sigCanvasRef.current;
    if (canvas) {
      canvas.clear();
    }
    setStrokeHistory([]);
    onSignatureChange(null);
    // Re-apply canvas scaling so the next drawing session works correctly
    setTimeout(resizeCanvas, 20);
  };

  return (
    <div className="signature-capture">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Signature {required && <span className="text-red-500">*</span>}
      </label>

      {/* Draw Signature */}
      <div>
          <div
            ref={canvasContainerRef}
            className="border-2 border-dashed border-gray-300 rounded-lg bg-white"
            style={{ touchAction: "none" }}
          >
            <SignatureCanvas
              ref={sigCanvasRef}
              penColor="black"
              canvasProps={{
                className: "signature-canvas rounded-lg",
                style: { width: "100%", height: "200px" },
              }}
              onEnd={handleDrawEnd}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-400">
              Use your mouse or finger to draw your signature above.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUndo}
                className="px-3 py-1 text-xs font-medium rounded border border-blue-300 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={handleClearDraw}
                className="px-3 py-1 text-xs font-medium rounded border border-red-300 text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

      {/* Validation Error */}
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
};

export default SignatureCapture;

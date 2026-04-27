import React, { useEffect, useState, useRef } from "react";
import {
  pngDownloadUrl,
  excalidrawDownloadUrl,
  fetchPngBlobUrl,
  downloadFile,
} from "../api";

function DiagramViewer({ excalidrawFile, runId }) {
  const [pngBlobUrl, setPngBlobUrl] = useState(null);
  const [showInteractive, setShowInteractive] = useState(false);
  const [Excalidraw, setExcalidraw] = useState(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const containerRef = useRef(null);

  // Fetch PNG as blob URL for reliable preview
  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    fetchPngBlobUrl(runId)
      .then((url) => {
        if (!cancelled) setPngBlobUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (pngBlobUrl) URL.revokeObjectURL(pngBlobUrl);
    };
  }, [runId]);

  // Lazily load Excalidraw only when the interactive view is requested
  useEffect(() => {
    if (!showInteractive || Excalidraw) return;
    import("@excalidraw/excalidraw")
      .then((mod) => setExcalidraw(() => mod.Excalidraw))
      .catch(() => setShowInteractive(false));
  }, [showInteractive]);

  // Fit all elements into view once the Excalidraw API is ready
  useEffect(() => {
    if (!excalidrawAPI) return;
    const timer = setTimeout(() => {
      excalidrawAPI.scrollToContent(undefined, {
        fitToContent: true,
        viewportZoomFactor: 0.85,
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [excalidrawAPI]);

  if (!excalidrawFile) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#868e96" }}>
        No diagram data available.
      </div>
    );
  }

  const initialData = {
    elements: excalidrawFile.elements || [],
    appState: {
      viewBackgroundColor: "#ffffff",
      currentItemFontFamily: 1,
      zoom: { value: 1 },
      ...(excalidrawFile.appState || {}),
    },
    scrollToContent: true,
  };

  const handleDownloadPng = () => {
    downloadFile(pngDownloadUrl(runId), "architecture.png").catch((err) => {
      console.error("PNG download failed:", err);
      alert("PNG download failed: " + err.message);
    });
  };

  const handleDownloadExcalidraw = () => {
    downloadFile(excalidrawDownloadUrl(runId), "architecture.excalidraw").catch(
      (err) => {
        console.error("Excalidraw download failed:", err);
        alert("Excalidraw download failed: " + err.message);
      }
    );
  };

  const interactiveView =
    showInteractive && Excalidraw ? (
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        initialData={initialData}
        viewModeEnabled={false}
        zenModeEnabled={false}
        gridModeEnabled={false}
        theme="light"
      />
    ) : showInteractive ? (
      <div className="loading">
        <div className="spinner" />
        Loading interactive editor...
      </div>
    ) : null;

  return (
    <div>
      <div className="diagram-container" ref={containerRef}>
        {showInteractive ? (
          interactiveView
        ) : pngBlobUrl ? (
          <img
            src={pngBlobUrl}
            alt="Architecture Diagram"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              padding: 16,
            }}
          />
        ) : (
          <div className="loading">
            <div className="spinner" />
            Loading diagram preview...
          </div>
        )}
      </div>

      {runId && (
        <div className="diagram-actions">
          <button className="btn btn-secondary" onClick={handleDownloadPng}>
            Download PNG
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleDownloadExcalidraw}
          >
            Download Excalidraw
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowInteractive((v) => !v)}
          >
            {showInteractive ? "Back to Preview" : "Open Interactive Editor"}
          </button>
        </div>
      )}
    </div>
  );
}

export default DiagramViewer;

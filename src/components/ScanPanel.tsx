import { useRef, useState } from 'react'
import { Check, Eye, FileImage, ScanLine, ShieldCheck, Upload, WandSparkles } from 'lucide-react'
import { SCAN_CHECKS } from '../data'
import type { ScanModality, ScanState } from '../types'

interface ScanPanelProps {
  scan: ScanState
  onModalityChange: (modality: ScanModality) => void
  onImageReady: (image: string, fileName: string) => void
  onSimulate: () => void
  onToggleCheck: (checkId: string) => void
  onOpenGuidance: () => void
}

export function ScanPanel({
  scan,
  onModalityChange,
  onImageReady,
  onSimulate,
  onToggleCheck,
  onOpenGuidance,
}: ScanPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const checks = SCAN_CHECKS[scan.modality]

  const handleImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setUploadError('Select an image file for the local scan preview.')
      return
    }
    if (file.size > 1_500_000) {
      setUploadError('Choose an image smaller than 1.5 MB so it can remain in local browser storage.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImageReady(reader.result, file.name)
        setUploadError(null)
      }
    }
    reader.onerror = () => setUploadError('The selected image could not be read on this device.')
    reader.readAsDataURL(file)
  }

  return (
    <section className="panel scan-panel" aria-labelledby="scan-title">
      <div className="panel-heading scan-heading">
        <div>
          <div className="eyebrow"><ScanLine size={14} aria-hidden="true" /> Portable imaging</div>
          <h2 id="scan-title">Ocular & anatomy self-inspection</h2>
          <p>Structured local capture for SANS, bone, and organ observation. Images stay on this device.</p>
        </div>
        <button className="text-button" type="button" onClick={onOpenGuidance}>
          Guidance <Eye size={15} aria-hidden="true" />
        </button>
      </div>

      <div className="scan-layout">
        <div className="scan-preview-wrap">
          {scan.image ? (
            <img className="scan-preview" src={scan.image} alt={`${scan.modality === 'ocular-oct' ? 'Ocular OCT' : 'Portable ultrasound'} local preview`} />
          ) : (
            <div className="scan-empty-state">
              <FileImage size={29} aria-hidden="true" />
              <strong>No scan loaded</strong>
              <span>Upload a local image or generate a non-diagnostic simulation.</span>
            </div>
          )}
          <div className="scan-overlay-label">
            {scan.modality === 'ocular-oct' ? 'OCULAR OCT / SANS' : 'PORTABLE ULTRASOUND'}
          </div>
        </div>

        <div className="scan-controls">
          <div className="modality-switch" role="group" aria-label="Scan modality">
            <button
              type="button"
              className={scan.modality === 'ocular-oct' ? 'modality-button modality-button--active' : 'modality-button'}
              onClick={() => onModalityChange('ocular-oct')}
            >
              Ocular OCT
            </button>
            <button
              type="button"
              className={scan.modality === 'portable-ultrasound' ? 'modality-button modality-button--active' : 'modality-button'}
              onClick={() => onModalityChange('portable-ultrasound')}
            >
              Ultrasound
            </button>
          </div>

          <input ref={inputRef} className="sr-only" type="file" accept="image/*" onChange={handleImage} />
          <div className="scan-action-row">
            <button className="secondary-button" type="button" onClick={() => inputRef.current?.click()}>
              <Upload size={16} aria-hidden="true" /> Upload image
            </button>
            <button className="secondary-button" type="button" onClick={onSimulate}>
              <WandSparkles size={16} aria-hidden="true" /> Simulate scan
            </button>
          </div>
          {uploadError && <p className="upload-error" role="alert">{uploadError}</p>}
          <div className="scan-file-meta">
            <ShieldCheck size={15} aria-hidden="true" />
            <span>{scan.fileName ? `${scan.fileName}${scan.updatedAt ? ` · saved ${new Date(scan.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}` : 'Local browser storage only'}</span>
          </div>
        </div>
      </div>

      <div className="inspection-checklist">
        <div className="inspection-header">
          <div>
            <span className="eyebrow">Visual self-inspection checklist</span>
            <h3>{scan.modality === 'ocular-oct' ? 'SANS observation handoff' : 'Bone / organ observation handoff'}</h3>
          </div>
          <span>{checks.filter((item) => scan.checklist[item.id]).length}/{checks.length} reviewed</span>
        </div>
        <div className="inspection-items">
          {checks.map((item) => {
            const checked = Boolean(scan.checklist[item.id])
            return (
              <button
                type="button"
                key={item.id}
                className={checked ? 'inspection-item inspection-item--checked' : 'inspection-item'}
                aria-pressed={checked}
                onClick={() => onToggleCheck(item.id)}
              >
                <span className="inspection-box" aria-hidden="true">{checked && <Check size={14} strokeWidth={3} />}</span>
                <span><strong>{item.label}</strong><small>{item.detail}</small></span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

import { useMemo } from 'react'

interface FunnelStage {
  name: string
  count: number
  percentage: number
  color: string
}

interface FunnelChartProps {
  stages: FunnelStage[]
  showDropOff?: boolean
}

export default function FunnelChart({ stages, showDropOff = true }: FunnelChartProps) {
  // Calculate drop-off between stages
  const stagesWithDropOff = useMemo(() => {
    return stages.map((stage, index) => {
      const prevStage = index > 0 ? stages[index - 1] : null
      const dropOff = prevStage && prevStage.count > 0
        ? ((prevStage.count - stage.count) / prevStage.count) * 100
        : 0
      const conversionFromPrev = prevStage && prevStage.count > 0
        ? (stage.count / prevStage.count) * 100
        : 100

      return {
        ...stage,
        dropOff,
        conversionFromPrev,
      }
    })
  }, [stages])

  if (stages.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400">
        Aucune donnée disponible
      </div>
    )
  }

  const maxCount = Math.max(...stages.map(s => s.count), 1)

  return (
    <div className="space-y-3">
      {stagesWithDropOff.map((stage, index) => {
        const widthPercent = (stage.count / maxCount) * 100

        return (
          <div key={stage.name}>
            {/* Drop-off indicator */}
            {showDropOff && index > 0 && stage.dropOff > 0 && (
              <div className="flex items-center gap-2 mb-2 ml-4">
                <div className="flex-1 border-l-2 border-dashed border-red-300 h-4"></div>
                <span className="text-xs text-red-500 font-medium">
                  ↓ {stage.dropOff.toFixed(1)}% perdus
                </span>
                <span className="text-xs text-gray-400">
                  ({stage.conversionFromPrev.toFixed(0)}% conversion)
                </span>
              </div>
            )}

            {/* Stage bar */}
            <div className="flex items-center gap-4">
              {/* Label */}
              <div className="w-40 text-sm font-medium text-gray-700 text-right">
                {stage.name}
              </div>

              {/* Bar */}
              <div className="flex-1 relative">
                <div className="h-12 bg-gray-100 rounded-lg overflow-hidden">
                  <div
                    className="h-full rounded-lg transition-all duration-500 flex items-center justify-end pr-4"
                    style={{
                      width: `${Math.max(widthPercent, 5)}%`,
                      backgroundColor: stage.color,
                    }}
                  >
                    <span className="text-white font-bold text-lg drop-shadow">
                      {stage.count}
                    </span>
                  </div>
                </div>
              </div>

              {/* Percentage */}
              <div className="w-16 text-right">
                <span className="text-lg font-bold" style={{ color: stage.color }}>
                  {stage.percentage.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Compact version for sidebar or smaller spaces
export function FunnelChartCompact({ stages }: { stages: FunnelStage[] }) {
  if (stages.length === 0) {
    return (
      <div className="text-center text-gray-400 py-4">
        Aucune donnée
      </div>
    )
  }

  const maxCount = Math.max(...stages.map(s => s.count), 1)

  return (
    <div className="space-y-2">
      {stages.map((stage) => {
        const widthPercent = (stage.count / maxCount) * 100

        return (
          <div key={stage.name} className="flex items-center gap-2">
            <div className="w-24 text-xs text-gray-600 truncate" title={stage.name}>
              {stage.name}
            </div>
            <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
              <div
                className="h-full rounded flex items-center justify-end px-2"
                style={{
                  width: `${Math.max(widthPercent, 10)}%`,
                  backgroundColor: stage.color,
                }}
              >
                <span className="text-white text-xs font-medium">
                  {stage.count}
                </span>
              </div>
            </div>
            <div className="w-10 text-xs font-medium text-right" style={{ color: stage.color }}>
              {stage.percentage.toFixed(0)}%
            </div>
          </div>
        )
      })}
    </div>
  )
}

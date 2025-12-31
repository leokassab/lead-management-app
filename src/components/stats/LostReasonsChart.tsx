import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

interface LostReason {
  reason: string
  count: number
  percentage: number
}

interface LostReasonsChartProps {
  data: LostReason[]
  showTable?: boolean
}

const COLORS = [
  '#EF4444', // red-500
  '#F97316', // orange-500
  '#F59E0B', // amber-500
  '#EAB308', // yellow-500
  '#84CC16', // lime-500
  '#22C55E', // green-500
  '#14B8A6', // teal-500
  '#06B6D4', // cyan-500
  '#3B82F6', // blue-500
  '#8B5CF6', // violet-500
]

const REASON_LABELS: Record<string, string> = {
  'budget': 'Budget insuffisant',
  'timing': 'Mauvais timing',
  'competitor': 'Choix concurrent',
  'no_need': 'Pas de besoin',
  'no_response': 'Sans réponse',
  'not_qualified': 'Non qualifié',
  'other': 'Autre',
}

export default function LostReasonsChart({ data, showTable = true }: LostReasonsChartProps) {
  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      name: REASON_LABELS[item.reason] || item.reason,
      color: COLORS[index % COLORS.length],
    }))
  }, [data])

  const total = useMemo(() => data.reduce((sum, item) => sum + item.count, 0), [data])

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400">
        Aucune donnée de perte disponible
      </div>
    )
  }

  return (
    <div className={showTable ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : ''}>
      {/* Donut Chart */}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="count"
              nameKey="name"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [
                `${value} leads (${((Number(value) / total) * 100).toFixed(1)}%)`,
              ]}
            />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              formatter={(value) => <span className="text-sm text-gray-700">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      {showTable && (
        <div className="overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  Raison
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                  Nombre
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((item) => (
                <tr key={item.reason} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-gray-700">{item.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-sm font-medium text-gray-900">{item.count}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-sm text-gray-600">{item.percentage.toFixed(1)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50">
                <td className="py-3 px-4">
                  <span className="text-sm font-semibold text-gray-700">Total</span>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="text-sm font-bold text-gray-900">{total}</span>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="text-sm font-semibold text-gray-600">100%</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// Compact version without table
export function LostReasonsChartCompact({ data }: { data: LostReason[] }) {
  return <LostReasonsChart data={data} showTable={false} />
}

// Stage drop-off chart - shows where in the funnel leads are lost
interface DropOffData {
  fromStage: string
  toStage: string
  lostCount: number
  percentage: number
}

interface DropOffChartProps {
  data: DropOffData[]
}

export function DropOffChart({ data }: DropOffChartProps) {
  const maxLost = Math.max(...data.map(d => d.lostCount), 1)

  if (data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-gray-400">
        Aucune donnée disponible
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const widthPercent = (item.lostCount / maxLost) * 100

        return (
          <div key={`${item.fromStage}-${item.toStage}`} className="flex items-center gap-4">
            {/* Transition label */}
            <div className="w-48 text-sm text-gray-600 text-right">
              <span className="font-medium">{item.fromStage}</span>
              <span className="mx-2 text-gray-400">→</span>
              <span className="font-medium">{item.toStage}</span>
            </div>

            {/* Bar */}
            <div className="flex-1 h-8 bg-gray-100 rounded overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded flex items-center justify-end pr-3 transition-all duration-500"
                style={{ width: `${Math.max(widthPercent, 8)}%` }}
              >
                <span className="text-white text-sm font-medium">
                  {item.lostCount}
                </span>
              </div>
            </div>

            {/* Percentage */}
            <div className="w-16 text-right">
              <span className="text-sm font-semibold text-red-500">
                {item.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

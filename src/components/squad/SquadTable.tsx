import { Badge } from '@components/ui/Badge'
import type { SoldPlayerRecord } from '@/types/player'

interface SquadTableProps {
  squad: SoldPlayerRecord[]
  totalPurse: number
  currentPurse: number
}

export function SquadTable({ squad, totalPurse, currentPurse }: SquadTableProps) {
  const spent = totalPurse - currentPurse
  const roleOrder = { WK: 0, BAT: 1, AR: 2, BWL: 3 }
  const sorted = [...squad].sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9))

  return (
    <div className="flex flex-col gap-3">
      {/* Summary */}
      <div className="flex gap-4 text-sm">
        <span className="text-gray-400">{squad.length} players</span>
        <span className="text-gray-400">Spent: <span className="text-ipl-accent font-bold">₹{spent.toFixed(2)} Cr</span></span>
        <span className="text-gray-400">Remaining: <span className="text-ipl-gold font-bold">₹{currentPurse.toFixed(2)} Cr</span></span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ipl-border text-gray-500 text-xs uppercase">
              <th className="text-left py-2 pr-4">Player</th>
              <th className="text-left py-2 pr-4">Role</th>
              <th className="text-left py-2 pr-4">Status</th>
              <th className="text-right py-2">Price</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => (
              <tr key={p.playerId} className="border-b border-ipl-border/50 hover:bg-ipl-dark">
                <td className="py-2 pr-4">
                  <div>
                    <span className="text-white font-medium">{p.name}</span>
                    {p.isOverseas && <Badge variant="blue" className="ml-2">OS</Badge>}
                  </div>
                  <span className="text-gray-500 text-xs">{p.country}</span>
                </td>
                <td className="py-2 pr-4">
                  <Badge variant={p.role === 'BAT' ? 'gold' : p.role === 'BWL' ? 'blue' : p.role === 'AR' ? 'green' : 'red'}>
                    {p.role}
                  </Badge>
                </td>
                <td className="py-2 pr-4">
                  {p.isRetained
                    ? <Badge variant="gray">Retained</Badge>
                    : <Badge variant="default">Bought</Badge>}
                </td>
                <td className="py-2 text-right font-mono text-ipl-gold">₹{p.soldPrice.toFixed(2)} Cr</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {squad.length === 0 && (
        <p className="text-gray-600 text-center py-6">No players yet</p>
      )}
    </div>
  )
}

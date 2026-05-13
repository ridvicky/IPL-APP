import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Screens will be imported here as they are built.
// Placeholder keeps the router valid during incremental build.
function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-ipl-dark">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-yellow-400 mb-2">{name}</h1>
        <p className="text-slate-400 text-sm">Building in progress…</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Placeholder name="Login" />} />
        <Route path="/home" element={<Placeholder name="Home" />} />
        <Route path="/auction/select" element={<Placeholder name="Auction Selection" />} />
        <Route path="/auction/franchise" element={<Placeholder name="Franchise Selection" />} />
        <Route path="/auction/difficulty" element={<Placeholder name="Difficulty" />} />
        <Route path="/auction/retention" element={<Placeholder name="Retention Setup" />} />
        <Route path="/auction/room" element={<Placeholder name="Auction Room" />} />
        <Route path="/auction/squad/mine" element={<Placeholder name="My Squad" />} />
        <Route path="/auction/squad/all" element={<Placeholder name="All Squads" />} />
        <Route path="/auction/history" element={<Placeholder name="Auction History" />} />
        <Route path="/auction/unsold" element={<Placeholder name="Unsold Players" />} />
        <Route path="/auction/review" element={<Placeholder name="Final Squad Review" />} />
        <Route path="/sessions" element={<Placeholder name="Saved Sessions" />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PageLayout      from '@components/layout/PageLayout'
import Dashboard       from '@pages/Dashboard'
import MapIntelligence from '@pages/MapIntelligence'
import Forecast        from '@pages/Forecast'
import CropExplorer    from '@pages/CropExplorer'
import Reports         from '@pages/Reports'
import AIAdvisor       from '@pages/AIAdvisor'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PageLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="map"       element={<MapIntelligence />} />
          <Route path="forecast"  element={<Forecast />} />
          <Route path="crops"     element={<CropExplorer />} />
          <Route path="reports"   element={<Reports />} />
          <Route path="advisor"   element={<AIAdvisor />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

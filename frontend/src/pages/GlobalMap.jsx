import { useState, useEffect, useMemo } from 'react'
import { PageWrapper } from '../components/layout/PageWrapper'
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup
} from 'react-simple-maps'
import { useAuth } from '../context/AuthContext'
import { getCompanies } from '../services/api'
import { Globe, Search, Filter, Loader2, Building2, MapPin, X } from 'lucide-react'

const geoUrl = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json"

export default function GlobalMap() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [enriching, setEnriching] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState(null)
  const { token } = useAuth()

  // Filters
  const [minScore, setMinScore] = useState(0)
  const [selectedRegion, setSelectedRegion] = useState("All")
  const [selectedCountry, setSelectedCountry] = useState("All")
  const [selectedDomain, setSelectedDomain] = useState("All")

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getCompanies(token)
        setCompanies(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [token])

  const handleEnrich = async () => {
    setEnriching(true)
    try {
      await fetch('/api/companies/enrich', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      // Refresh
      const data = await getCompanies(token)
      setCompanies(data)
    } catch (e) {
      console.error(e)
    } finally {
      setEnriching(false)
    }
  }

  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      // Require coordinates to map
      if (c.latitude === null || c.longitude === null) return false
      if ((c.slm_score || 0) < minScore) return false
      if (selectedRegion !== "All" && c.region !== selectedRegion) return false
      if (selectedCountry !== "All" && c.country !== selectedCountry) return false
      if (selectedDomain !== "All" && c.industry !== selectedDomain) return false
      return true
    })
  }, [companies, minScore, selectedRegion, selectedCountry, selectedDomain])

  const regions = ["All", ...new Set(companies.map(c => c.region).filter(Boolean))]
  const countries = ["All", ...new Set(companies.map(c => c.country).filter(Boolean))]
  const domains = ["All", ...new Set(companies.map(c => c.industry).filter(Boolean))]

  if (loading) {
    return (
      <PageWrapper className="flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500 w-8 h-8" />
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Globe className="text-emerald-400" /> Global Intelligence
          </h1>
          <p className="text-sm text-slate-400 mt-1">Geospatial overview and SLM-powered Relanto Fit Scores.</p>
        </div>
        <button 
          onClick={handleEnrich} 
          disabled={enriching}
          className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-500/30 transition-colors flex items-center gap-2"
        >
          {enriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Enrich / Score Missing Companies
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Filters Sidebar */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 h-fit space-y-6">
          <div className="flex items-center gap-2 text-slate-200 font-semibold mb-2">
            <Filter size={18} className="text-blue-400" /> Filters
          </div>

          <div>
            <label className="text-xs text-slate-400 font-mono mb-2 block">MIN SLM SCORE: {minScore}</label>
            <input 
              type="range" 
              min="0" max="100" 
              value={minScore} 
              onChange={e => setMinScore(Number(e.target.value))}
              className="w-full accent-emerald-500 bg-slate-700 rounded-lg appearance-none h-2"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 font-mono mb-2 block">REGION</label>
            <select 
              value={selectedRegion} 
              onChange={e => setSelectedRegion(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-500/50 transition-colors"
            >
              {regions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-mono mb-2 block">COUNTRY</label>
            <select 
              value={selectedCountry} 
              onChange={e => setSelectedCountry(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-500/50 transition-colors"
            >
              {countries.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-mono mb-2 block">INDUSTRY DOMAIN</label>
            <select 
              value={selectedDomain} 
              onChange={e => setSelectedDomain(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-500/50 transition-colors"
            >
              {domains.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="pt-4 border-t border-slate-700/50">
            <p className="text-xs text-slate-400 font-mono">COMPANIES DISPLAYED</p>
            <p className="text-3xl font-bold text-slate-200 mt-1">{filteredCompanies.length}</p>
          </div>
        </div>

        {/* Map Container */}
        <div className="lg:col-span-3 bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden relative" style={{ height: "600px" }}>
          
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 140 }}
            style={{ width: "100%", height: "100%", backgroundColor: "#0f172a" }} // dark slate-900 bg
          >
            <ZoomableGroup center={[0, 20]} zoom={1} maxZoom={5}>
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="#1e293b" // slate-800
                      stroke="#334155" // slate-700
                      strokeWidth={0.5}
                      style={{
                        default: { outline: "none" },
                        hover: { fill: "#334155", outline: "none" },
                        pressed: { outline: "none" },
                      }}
                    />
                  ))
                }
              </Geographies>

              {filteredCompanies.map(c => (
                <Marker 
                  key={c.id} 
                  coordinates={[c.longitude, c.latitude]}
                  onClick={() => setSelectedCompany(c)}
                  className="cursor-pointer"
                >
                  <circle 
                    r={c.slm_score > 80 ? 8 : 5} 
                    fill={c.slm_score > 80 ? "#34d399" : "#60a5fa"} // emerald for high score, blue otherwise
                    stroke="#ffffff"
                    strokeWidth={1}
                    className="hover:scale-125 transition-transform origin-center drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  />
                </Marker>
              ))}
            </ZoomableGroup>
          </ComposableMap>

          {/* Company Details Popover */}
          {selectedCompany && (
            <div className="absolute bottom-5 right-5 w-80 bg-slate-900/95 backdrop-blur border border-slate-700/50 rounded-xl p-5 shadow-2xl z-10 animate-in slide-in-from-bottom-4">
              <button 
                onClick={() => setSelectedCompany(null)}
                className="absolute top-3 right-3 text-slate-500 hover:text-slate-300"
              >
                <X size={16} />
              </button>
              
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700">
                  <Building2 size={20} className="text-slate-400" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-200">{selectedCompany.name}</h3>
                  <a href={selectedCompany.website} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline">{selectedCompany.website}</a>
                </div>
              </div>

              <div className="space-y-3 mt-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <span className="text-xs text-slate-500 font-mono">INDUSTRY</span>
                  <span className="text-sm text-slate-300">{selectedCompany.industry}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <span className="text-xs text-slate-500 font-mono">LOCATION</span>
                  <span className="text-sm text-slate-300 flex items-center gap-1"><MapPin size={12}/> {selectedCompany.country || selectedCompany.hq_location}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <span className="text-xs text-slate-500 font-mono">TIMEZONE</span>
                  <span className="text-sm text-slate-300">{selectedCompany.timezone}</span>
                </div>
                
                <div className="pt-2">
                  <span className="text-xs text-slate-500 font-mono block mb-1">RELANTO FIT SCORE</span>
                  <div className="flex items-end gap-2">
                    <span className={`text-3xl font-bold ${selectedCompany.slm_score > 80 ? 'text-emerald-400' : 'text-blue-400'}`}>
                      {selectedCompany.slm_score}
                    </span>
                    <span className="text-sm text-slate-500 mb-1">/ 100</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </PageWrapper>
  )
}

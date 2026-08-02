import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import './index.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const initialKiosk = {
  cedula: '',
  sede: '',
  nombre: '',
  apellido: '',
  fecha_nacimiento: '',
  email: '',
  celular: '',
}

const FOOTER_SECTIONS = {
  terms: {
    title: 'Términos y Condiciones',
    content: `Al utilizar SYNAP y los servicios de Ninja Park, aceptas estos términos. El registro de datos personales es voluntario y necesario para la gestión de ingresos y facturación. Ninja Park se reserva el derecho de actualizar estos términos sin previo aviso. SYNAP es una plataforma de VERSA.JS.`,
  },
  privacy: {
    title: 'Políticas de Privacidad',
    content: `Tus datos personales son tratados con total confidencialidad. Cumplimos con la LOPDP (Ley Orgánica de Protección de Datos Personales). No compartimos información con terceros sin tu consentimiento explícito. Puedes solicitar la eliminación de tus datos en cualquier momento.`,
  },
  faq: {
    title: 'Preguntas Frecuentes',
    content: `¿Cómo registro a mi representado? Solo debes seguir el flujo del kiosko, ingresar cédula, datos personales, acompañantes y foto. ¿Puedo editar mi registro? Sí, el administrador de cada sede puede actualizar datos en tiempo real. ¿Qué pasa si no tengo foto? Puedes omitirla y finalizar el registro.`,
  },
  contact: {
    title: 'Contáctanos',
    content: 'Dirección: Caracas, Venezuela\n\nEmail: soporte@ninjapark.com\nTeléfono: +58 412-1234567\nHorario: Lun-Sáb 9:00 - 20:00\n\nNinja Park Candelaria · Ninja Park Chacao',
  },
}

function App() {
  const [view, setView] = useState('welcome')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [sedes, setSedes] = useState([])
  const [scrollSections, setScrollSections] = useState({})

  const scrollRef = useCallback((sectionName) => (node) => {
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setScrollSections((prev) => ({ ...prev, [sectionName]: true }))
          observer.unobserve(node)
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(node)
  }, [])

  const [kiosk, setKiosk] = useState(initialKiosk)
  const [kioskStep, setKioskStep] = useState(1)
  const [kioskRepresentadosCount, setKioskRepresentadosCount] = useState(0)
  const [kioskRepresentados, setKioskRepresentados] = useState([])
  const [kioskPhoto, setKioskPhoto] = useState(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [stream, setStream] = useState(null)
  const videoRef = useRef(null)

  const [adminToken, setAdminToken] = useState(localStorage.getItem('synap_admin_token') || '')
  const [adminUser, setAdminUser] = useState(null)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [adminTab, setAdminTab] = useState('dashboard')

  const [records, setRecords] = useState([])
  const [recordsTotal, setRecordsTotal] = useState(0)
  const [recordsPage, setRecordsPage] = useState(1)
  const [recordsPages, setRecordsPages] = useState(1)
  const [recordsLimit, setRecordsLimit] = useState(10)
  const [recordsQuery, setRecordsQuery] = useState('')
  const [recordsSede, setRecordsSede] = useState('')
  const [editRecord, setEditRecord] = useState(null)

  const [posCedula, setPosCedula] = useState('')
  const [posResult, setPosResult] = useState(null)

  const [billingCedula, setBillingCedula] = useState('')
  const [billingResult, setBillingResult] = useState(null)
  const [billingEvents, setBillingEvents] = useState([])

  const [footerSection, setFooterSection] = useState(null)

  const authHeaders = useMemo(() => (
    adminToken ? { Authorization: `Bearer ${adminToken}` } : {}
  ), [adminToken])

  const pushMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 4000)
  }

  const fetchSedes = async () => {
    try {
      const response = await axios.get(`${API_URL}/sedes`, { timeout: 5000 })
      const list = response.data.sedes || []
      setSedes(list)
      setKiosk((prev) => ({ ...prev, sede: prev.sede || list[0] || '' }))
    } catch (err) {
      const msg = err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK'
        ? 'Servidor backend no disponible. Asegúrate que el backend esté corriendo en puerto 3001.'
        : 'No se pudieron cargar las sedes. Verifica la conexión.'
      pushMessage('error', msg)
    }
  }

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    setCameraActive(false)
  }, [stream])

  const startCamera = useCallback(async () => {
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      })
      setStream(media)
      setCameraActive(true)
    } catch (error) {
      pushMessage('error', 'No se pudo activar la cámara. Revisa permisos del navegador.')
    }
  }, [])

  const capturePhoto = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const side = Math.max(600, Math.min(video.videoWidth || 600, video.videoHeight || 600))
    const canvas = document.createElement('canvas')
    canvas.width = side
    canvas.height = side
    const ctx = canvas.getContext('2d')
    const sx = Math.max(0, (video.videoWidth - side) / 2)
    const sy = Math.max(0, (video.videoHeight - side) / 2)
    ctx.drawImage(video, sx, sy, side, side, 0, 0, side, side)
    setKioskPhoto(canvas.toDataURL('image/jpeg', 0.9))
    stopCamera()
  }

  useEffect(() => {
    fetchSedes().catch(() => pushMessage('error', 'No se pudo cargar sedes.'))
  }, [])

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  useEffect(() => {
    if (!adminToken) {
      setAdminUser(null)
      return
    }
    axios.get(`${API_URL}/auth/me`, { headers: authHeaders })
      .then((res) => setAdminUser(res.data.user))
      .catch(() => {
        localStorage.removeItem('synap_admin_token')
        setAdminToken('')
        setAdminUser(null)
      })
  }, [adminToken, authHeaders])

  // Auto-refresh records every 10s when admin is on registros tab
  useEffect(() => {
    if (!(adminUser && view === 'admin' && adminTab === 'registros')) return
    const interval = setInterval(() => fetchRecords(recordsPage), 10000)
    return () => clearInterval(interval)
  }, [adminUser, view, adminTab, recordsPage])

  // ─── Kiosk handlers ───
  const updateRepresentadosCount = (value) => {
    const count = Math.max(0, Number.parseInt(value, 10) || 0)
    setKioskRepresentadosCount(count)
    const next = [...kioskRepresentados]
    while (next.length < count) next.push({ nombre: '', fecha_nacimiento: '' })
    while (next.length > count) next.pop()
    setKioskRepresentados(next)
  }

  const kioskStart = async () => {
    if (!kiosk.cedula.trim() || !kiosk.sede) {
      pushMessage('error', 'Debes ingresar cédula y sede.')
      return
    }
    setLoading(true)
    try {
      const response = await axios.post(`${API_URL}/kiosk/register-start`, {
        cedula: kiosk.cedula.trim(),
        sede: kiosk.sede,
      })
      const existing = response.data.data || {}
      setKiosk((prev) => ({
        ...prev,
        nombre: existing.nombre || prev.nombre,
        apellido: existing.apellido || prev.apellido,
        fecha_nacimiento: existing.fecha_nacimiento || prev.fecha_nacimiento,
        email: existing.email || prev.email,
        celular: existing.celular || prev.celular,
      }))
      setKioskStep(2)
    } catch (error) {
      pushMessage('error', error.response?.data?.error || 'No se pudo iniciar registro.')
    } finally { setLoading(false) }
  }

  const kioskToStep3 = () => {
    if (!kiosk.nombre.trim() || !kiosk.apellido.trim() || !kiosk.fecha_nacimiento) {
      pushMessage('error', 'Completa nombre, apellido y fecha de nacimiento.')
      return
    }
    setKioskStep(3)
  }

  const kioskToStep4 = () => {
    for (let i = 0; i < kioskRepresentados.length; i += 1) {
      if (!kioskRepresentados[i].nombre.trim() || !kioskRepresentados[i].fecha_nacimiento) {
        pushMessage('error', `Completa el acompañante #${i + 1}.`)
        return
      }
    }
    setKioskStep(4)
    setTimeout(() => startCamera(), 250)
  }

  const submitKiosk = async (skipPhoto = false) => {
    setLoading(true)
    try {
      const payload = {
        ...kiosk,
        cedula: kiosk.cedula.trim(),
        nombre: kiosk.nombre.trim(),
        apellido: kiosk.apellido.trim(),
        email: kiosk.email.trim() || null,
        celular: kiosk.celular.trim() || null,
        representados: kioskRepresentados,
      }
      await axios.post(`${API_URL}/kiosk/register-complete`, payload)
      if (!skipPhoto && kioskPhoto) {
        const blob = await (await fetch(kioskPhoto)).blob()
        const form = new FormData()
        form.append('cedula', kiosk.cedula.trim())
        form.append('foto', blob, `kiosk_${kiosk.cedula.trim()}.jpg`)
        await axios.post(`${API_URL}/kiosk/upload-photo`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
      pushMessage('success', '¡Registro completado con éxito!')
      setKiosk(initialKiosk)
      setKioskRepresentados([])
      setKioskRepresentadosCount(0)
      setKioskPhoto(null)
      setKioskStep(1)
      setView('welcome')
      stopCamera()
      setTimeout(() => setKiosk((prev) => ({ ...prev, sede: sedes[0] || '' })), 0)
    } catch (error) {
      pushMessage('error', error.response?.data?.error || 'No se pudo completar.')
    } finally { setLoading(false) }
  }

  // ─── Admin handlers ───
  const adminLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await axios.post(`${API_URL}/auth/login`, loginForm)
      localStorage.setItem('synap_admin_token', response.data.token)
      setAdminToken(response.data.token)
      setLoginForm({ username: '', password: '' })
      setView('admin')
      pushMessage('success', `Bienvenido ${response.data.user.nombre || response.data.user.username}`)
    } catch (error) {
      pushMessage('error', 'Credenciales inválidas.')
    } finally { setLoading(false) }
  }

  const adminLogout = () => {
    localStorage.removeItem('synap_admin_token')
    setAdminToken('')
    setAdminUser(null)
    setView('welcome')
    setAdminTab('dashboard')
    pushMessage('success', 'Sesión cerrada correctamente.')
  }

  const fetchRecords = async (page = recordsPage) => {
    if (!adminUser) return
    try {
      const response = await axios.get(`${API_URL}/admin/records`, {
        headers: authHeaders,
        params: {
          page, limit: recordsLimit,
          q: recordsQuery || undefined,
          sede: adminUser.role === 'master' ? (recordsSede || undefined) : undefined,
        },
      })
      setRecords(response.data.records || [])
      setRecordsPage(response.data.page || 1)
      setRecordsPages(response.data.totalPages || 1)
      setRecordsTotal(response.data.total || 0)
    } catch (error) {
      pushMessage('error', 'No se pudieron cargar registros.')
    }
  }

  const exportRecords = async (format, scope) => {
    try {
      const endpoint = format === 'xlsx' ? '/admin/export.xlsx' : '/admin/export'
      const response = await axios.get(`${API_URL}${endpoint}`, {
        headers: authHeaders,
        responseType: 'blob',
        params: {
          page: recordsPage, limit: recordsLimit,
          q: recordsQuery || undefined,
          sede: adminUser?.role === 'master' ? (recordsSede || undefined) : undefined,
          scope,
        },
      })
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `registros_${scope}.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(blobUrl)
      pushMessage('success', `Exportación ${format.toUpperCase()} descargada.`)
    } catch (error) {
      pushMessage('error', 'No se pudo exportar.')
    }
  }

  const saveEditRecord = async () => {
    if (!editRecord) return
    setLoading(true)
    try {
      await axios.patch(`${API_URL}/admin/records/${editRecord.id}`, editRecord, { headers: authHeaders })
      pushMessage('success', 'Registro actualizado en tiempo real.')
      setEditRecord(null)
      fetchRecords(recordsPage)
    } catch (error) {
      pushMessage('error', error.response?.data?.error || 'No se pudo guardar.')
    } finally { setLoading(false) }
  }

  const posLookup = async () => {
    if (!posCedula.trim()) return
    setLoading(true)
    try {
      const response = await axios.get(`${API_URL}/pos/autocomplete/${posCedula.trim()}`, { headers: authHeaders })
      setPosResult(response.data.data)
    } catch (error) {
      setPosResult(null)
      pushMessage('error', error.response?.data?.error || 'No se encontró cliente.')
    } finally { setLoading(false) }
  }

  const billingLookup = async () => {
    if (!billingCedula.trim()) return
    setLoading(true)
    try {
      const response = await axios.get(`${API_URL}/billing/lookup/${billingCedula.trim()}`, { headers: authHeaders })
      setBillingResult(response.data.data)
      const notif = await axios.get(`${API_URL}/billing/notifications`, {
        headers: authHeaders,
        params: { cedula: billingCedula.trim(), page: 1, limit: 8 },
      })
      setBillingEvents(notif.data.notifications || [])
    } catch (error) {
      pushMessage('error', error.response?.data?.error || 'No se pudo consultar.')
    } finally { setLoading(false) }
  }

  const sendBillingWebhook = async (status) => {
    const cedula = billingResult?.cedula || billingCedula.trim()
    if (!cedula) return
    setLoading(true)
    try {
      await axios.post(`${API_URL}/billing/webhook`, {
        cedula, event_type: `payment.${status}`, status,
        amount: billingResult?.amount_suggested || 0,
        currency: 'USD', provider: 'kiosk-dashboard',
        reference: `POS-${Date.now()}`,
      }, { headers: authHeaders })
      pushMessage('success', `Evento "${status}" registrado.`)
      await billingLookup()
    } catch (error) {
      pushMessage('error', 'Error al registrar evento.')
    } finally { setLoading(false) }
  }

  // ─── Skeleton loader ───
  const SkeletonRow = () => (
    <tr className='border-t border-white/10 animate-pulse'>
      {[1,2,3,4,5,6,7].map(i => (
        <td key={i} className='py-3 px-3'><div className='h-4 rounded bg-white/10 w-3/4' /></td>
      ))}
    </tr>
  )

  // ─── RENDER: Footer ───
  const renderFooter = () => (
    <footer className='footer-bg pt-16 pb-8 px-4 sm:px-8'>
      <div className='max-w-7xl mx-auto'>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12'>
          {/* Brand */}
          <div className='lg:col-span-1'>
            <div className='flex items-center gap-3 mb-4'>
              <div className='w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 via-indigo-500 to-purple-600 flex items-center justify-center text-white font-black shadow-lg shadow-cyan-500/25'>S</div>
              <div>
                <span className='text-white font-bold text-xl tracking-tight'>SYNAP</span>
                <span className='block text-slate-500 text-[10px] uppercase tracking-[0.2em] font-medium'>by VERSA.JS</span>
              </div>
            </div>
            <p className='text-slate-400 text-sm leading-relaxed'>
              Plataforma inteligente de registro y facturación para centros de entretenimiento. Diseñada por <span className='text-cyan-400/70'>VERSA.JS</span> — tecnología que transforma experiencias.
            </p>
            <div className='flex gap-3 mt-4'>
              <span className='w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-300 text-xs hover:bg-cyan-500/20 hover:text-cyan-300 transition cursor-pointer'>in</span>
              <span className='w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-300 text-xs hover:bg-cyan-500/20 hover:text-cyan-300 transition cursor-pointer'>ig</span>
              <span className='w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-300 text-xs hover:bg-cyan-500/20 hover:text-cyan-300 transition cursor-pointer'>fb</span>
            </div>
          </div>

          {/* Links */}
          {[
            { label: 'Inicio', onClick: () => { setFooterSection(null); window.scrollTo({top:0,behavior:'smooth'}) } },
            { label: 'Registro Cliente', onClick: () => { setFooterSection(null); setView('kiosk'); setKiosk(p => ({...p, sede: p.sede || sedes[0] || ''})) } },
            { label: 'Acceso Admin', onClick: () => { setFooterSection(null); setView('admin-login') } },
          ].map((link, i) => (
            <div key={i}>
              <h4 className='text-white font-semibold mb-3 text-sm uppercase tracking-wider'>Navegación</h4>
              <div className='space-y-2'>
                <p key={link.label} className='footer-link text-sm' onClick={link.onClick}>{link.label}</p>
              </div>
            </div>
          ))}

          {/* Legal */}
          <div>
            <h4 className='text-white font-semibold mb-3 text-sm uppercase tracking-wider'>Legal</h4>
            <div className='space-y-2'>
              {Object.entries(FOOTER_SECTIONS).map(([key, section]) => (
                <p key={key} className='footer-link text-sm' onClick={() => setFooterSection(footerSection === key ? null : key)}>{section.title}</p>
              ))}
            </div>
          </div>

          {/* Sedes */}
          <div>
            <h4 className='text-white font-semibold mb-3 text-sm uppercase tracking-wider'>Sedes</h4>
            <div className='space-y-2'>
              {sedes.map((sede) => (
                <p key={sede} className='footer-link text-sm'>{sede}</p>
              ))}
              <p className='text-slate-500 text-xs mt-3'>📍 Caracas, Venezuela</p>
            </div>
          </div>
        </div>

        {/* Expanded section */}
        {footerSection && (
          <div className='glass rounded-2xl p-6 mb-8 animate-fade-up'>
            <div className='flex items-center justify-between mb-3'>
              <h4 className='text-white font-bold text-lg'>{FOOTER_SECTIONS[footerSection].title}</h4>
              <button onClick={() => setFooterSection(null)} className='text-slate-400 hover:text-white text-xl leading-none'>&times;</button>
            </div>
            <p className='text-slate-300 text-sm leading-relaxed whitespace-pre-line'>{FOOTER_SECTIONS[footerSection].content}</p>
          </div>
        )}

        {/* Divider */}
        <div className='h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-6' />

        {/* Copyright */}
        <div className='flex flex-col sm:flex-row items-center justify-between gap-2'>
          <p className='text-slate-500 text-xs'>
            &copy; {new Date().getFullYear()} <span className='text-cyan-400 font-semibold'>VERSA<span className='text-white/30'>.</span>JS</span>. Todos los derechos reservados.
          </p>
          <p className='text-slate-600 text-xs'>
            Powered by <span className='text-cyan-400'>SYNAP</span> · Hecho en Caracas, Venezuela · v1.0.0
          </p>
        </div>
      </div>
    </footer>
  )

  // ─── RENDER: Welcome / Landing ───
  const renderWelcome = () => (
    <>
      {/* ─── NAV ─── */}
      <nav className='fixed top-0 left-0 right-0 z-50 px-4 sm:px-8 py-3'>
        <div className='max-w-7xl mx-auto flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <div className='w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-400 via-indigo-500 to-purple-600 flex items-center justify-center text-white font-black shadow-lg shadow-cyan-500/25 text-sm overflow-hidden animate-glow-pulse'>
              <span className='animate-float-slow inline-block'>S</span>
            </div>
            <div>
              <span className='text-white font-bold text-xl tracking-tight leading-none'>SYNAP</span>
              <span className='block text-slate-500 text-[9px] uppercase tracking-[0.25em] font-medium leading-tight'>by VERSA.JS</span>
            </div>
          </div>
          <div className='flex items-center gap-3'>
            <button onClick={() => { setView('kiosk'); setKiosk(p => ({...p, sede: p.sede || sedes[0] || ''})) }} className='k-btn-outline k-btn-sm'>Registrarse</button>
            <button onClick={() => setView('admin-login')} className='k-btn-primary k-btn-sm'>Admin</button>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className='hero-bg min-h-screen flex items-center pt-20 pb-16 px-4 sm:px-8 relative'>
        {/* Floating decorative particles */}
        <div className='absolute inset-0 pointer-events-none overflow-hidden'>
          <div className='absolute w-2 h-2 rounded-full bg-cyan-400/30 top-[15%] left-[10%] animate-float-drift' style={{animationDelay: '0s', animationDuration: '7s'}} />
          <div className='absolute w-1.5 h-1.5 rounded-full bg-indigo-400/30 top-[30%] left-[80%] animate-float-drift' style={{animationDelay: '1.2s', animationDuration: '9s'}} />
          <div className='absolute w-2.5 h-2.5 rounded-full bg-purple-400/20 top-[60%] left-[20%] animate-float-drift' style={{animationDelay: '0.5s', animationDuration: '8s'}} />
          <div className='absolute w-1 h-1 rounded-full bg-cyan-300/40 top-[70%] left-[70%] animate-float-drift' style={{animationDelay: '2s', animationDuration: '6s'}} />
          <div className='absolute w-1.5 h-1.5 rounded-full bg-amber-300/20 top-[45%] left-[45%] animate-float-drift' style={{animationDelay: '1s', animationDuration: '10s'}} />
        </div>
        <div className='max-w-7xl mx-auto w-full relative z-10'>
          <div className='grid lg:grid-cols-2 gap-12 items-center'>
            {/* Left */}
            <div className='animate-slide-up'>
              <div className='inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-5 animate-fade-in'>
                <span className='w-2 h-2 rounded-full bg-emerald-400 animate-pulse' />
                <span className='text-slate-300 text-xs sm:text-sm'>SYNAP activo — 2 sedes</span>
                <span className='w-px h-4 bg-white/20 mx-1' />
                <span className='text-cyan-300/80 text-xs font-medium'>by VERSA.JS</span>
              </div>
              <h1 className='text-4xl sm:text-5xl lg:text-7xl font-black text-white leading-[1.1] mb-5'>
                Registro inteligente{' '}
                <span className='bg-gradient-to-r from-cyan-300 via-indigo-300 to-purple-300 bg-clip-text text-transparent'>SYNAP</span>
              </h1>
              <p className='text-slate-300 text-lg sm:text-xl max-w-xl leading-relaxed mb-8'>
                Captura datos, fotos y acompañantes en segundos. Facturación sincronizada, panel master y control total desde cualquier sede. Una plataforma <span className='text-cyan-300 font-semibold'>VERSA.JS</span>.
              </p>
              {/* ─── HERO ACTIONS ─── */}
              <div className='flex flex-wrap gap-4'>
                <button onClick={() => { setView('kiosk'); setKiosk(p => ({...p, sede: p.sede || sedes[0] || ''})) }} className='k-btn-primary text-lg px-8 py-4 animate-pulse-glow'>
                  Iniciar Registro
                </button>
                <button onClick={() => setView('admin-login')} className='k-btn-outline text-lg px-8 py-4'>
                  Panel Admin
                </button>
              </div>
            </div>

            {/* Right - Stats & Cards */}
            <div className='grid grid-cols-2 gap-4'>
              {[
                { icon: 'Z', label: '< 2 min', desc: 'Registro exprés en pocos pasos', color: 'from-cyan-400 to-blue-500' },
                { icon: 'P', label: 'Foto + datos', desc: 'Captura integrada con cámara', color: 'from-indigo-400 to-purple-500' },
                { icon: 'S', label: 'Multi-sede', desc: 'Candelaria · Chacao', color: 'from-emerald-400 to-teal-500' },
                { icon: 'L', label: 'Panel vivo', desc: 'Datos actualizados al instante', color: 'from-amber-400 to-orange-500' },
              ].map((card, i) => (
                <div key={i} className={`glass-card rounded-2xl p-5 text-center reveal-${i + 1} stagger-${i + 1}`} style={scrollSections[`hero-card-${i}`] ? {} : { opacity: 0, transform: 'translateY(20px)' }} ref={scrollRef(`hero-card-${i}`)}>
                  <div className={`w-10 h-10 mx-auto mb-3 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>{card.icon}</div>
                  <div className='text-white font-bold text-sm'>{card.label}</div>
                  <div className='text-slate-400 text-xs mt-1'>{card.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURES: Experiencia Inmersiva ─── */}
      <section ref={scrollRef('features')} className='ninja-bg py-24 px-4 sm:px-8 relative overflow-hidden'>
        {/* Background decorative elements */}
        <div className='absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-float-slow' style={{animationDuration: '12s'}} />
        <div className='absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-float-slow' style={{animationDuration: '10s', animationDelay: '1s'}} />
        <div className='absolute top-1/3 right-1/3 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl animate-float-slow' style={{animationDuration: '14s', animationDelay: '0.5s'}} />

        <div className='max-w-7xl mx-auto relative z-10'>
          <div className='text-center mb-16' style={scrollSections['features'] ? {} : { opacity: 0, transform: 'translateY(30px)' }}>
            <span className='text-cyan-300 text-sm tracking-[0.3em] uppercase font-semibold'>El Proceso</span>
            <h2 className='text-4xl sm:text-5xl font-black text-white mt-3 mb-4 leading-tight'>
              Tu experiencia{' '}
              <span className='bg-gradient-to-r from-cyan-300 via-indigo-300 to-purple-300 bg-clip-text text-transparent'>SYNAP</span>
            </h2>
            <div className='w-24 h-1 mx-auto bg-gradient-to-r from-cyan-400 to-indigo-500 rounded-full animate-pulse-glow' />
          </div>

          {/* Timeline / Steps */}
          <div className='relative'>
            {/* Vertical connecting line (desktop) */}
            <div className='hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-400/40 via-indigo-400/40 to-purple-400/40' />

            <div className='space-y-20 lg:space-y-28'>
              {[
                {
                  num: '01',
                  title: 'Identificación',
                  subtitle: 'Tu primer contacto con SYNAP',
                  desc: 'Ingresa tu número de cédula y selecciona la sede Ninja Park donde deseas ingresar. El sistema reconoce si ya existes y precarga tus datos automáticamente.',
                  color: 'from-cyan-400 to-blue-500',
                  icon: 'ID',
                  align: 'left',
                },
                {
                  num: '02',
                  title: 'Datos Personales',
                  subtitle: 'Completa tu perfil digital',
                  desc: 'Capturamos tu nombre, email, celular y fecha de nacimiento. Toda tu información viaja cifrada y protegida bajo los más altos estándares de seguridad.',
                  color: 'from-indigo-400 to-purple-500',
                  icon: 'DB',
                  align: 'right',
                },
                {
                  num: '03',
                  title: 'Acompañantes',
                  subtitle: 'Registro grupal en un instante',
                  desc: 'Agrega los representados que ingresarán contigo. SYNAP gestiona grupos de cualquier tamaño, ideal para familias y eventos especiales.',
                  color: 'from-purple-400 to-pink-500',
                  icon: 'GR',
                  align: 'left',
                },
                {
                  num: '04',
                  title: 'Foto + Listo',
                  subtitle: 'Finaliza con un selfie',
                  desc: 'Toma una foto desde la cámara del kiosko o dispositivo. El registro queda completado al instante y la facturación se sincroniza en tiempo real con el panel administrativo.',
                  color: 'from-amber-400 to-orange-500',
                  icon: 'OK',
                  align: 'right',
                },
              ].map((step, i) => (
                <div key={i} ref={scrollRef(`step-${i}`)} className={`flex flex-col lg:flex-row items-center gap-8 lg:gap-12 ${step.align === 'right' ? 'lg:flex-row-reverse' : ''}`} style={scrollSections[`step-${i}`] ? {} : { opacity: 0, transform: 'translateY(40px)' }}>
                  {/* Content side */}
                  <div className='flex-1 w-full lg:w-1/2'>
                    <div className={`${step.align === 'right' ? 'lg:text-left' : 'lg:text-left'} text-left`}>
                      <span className={`inline-block text-6xl sm:text-7xl font-black bg-gradient-to-r ${step.color} bg-clip-text text-transparent opacity-20 leading-none mb-2 select-none animate-float-slow`} style={{animationDuration: '6s', animationDelay: `${i * 0.3}s`}}>
                        {step.num}
                      </span>
                      <h3 className='text-2xl sm:text-3xl font-bold text-white mb-2'>{step.title}</h3>
                      <p className='text-cyan-200/80 text-sm font-medium mb-3'>{step.subtitle}</p>
                      <p className='text-slate-400 text-base leading-relaxed max-w-lg'>{step.desc}</p>
                    </div>
                  </div>

                  {/* Visual side */}
                  <div className='flex-1 w-full lg:w-1/2 flex justify-center'>
                    <div className='relative group'>
                      <div className={`w-48 h-48 sm:w-56 sm:h-56 rounded-3xl bg-gradient-to-br ${step.color} p-[2px] shadow-xl transition-all duration-500 group-hover:scale-105 group-hover:shadow-2xl`}>
                        <div className='w-full h-full rounded-3xl ninja-bg flex items-center justify-center'>
                          <div className={`w-32 h-32 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-2xl animate-float`} style={{animationDelay: `${i * 0.2}s`, animationDuration: `${5 + i * 0.5}s`}}>
                            <span className='text-white text-3xl font-black opacity-90'>{step.icon}</span>
                          </div>
                        </div>
                      </div>
                      {/* Glow */}
                      <div className={`absolute -inset-4 bg-gradient-to-br ${step.color} opacity-0 group-hover:opacity-20 blur-2xl transition-opacity duration-500 rounded-3xl -z-10`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className='cta-bg py-20 px-4 sm:px-8 relative overflow-hidden'>
        {/* Floating particles */}
        <div className='absolute inset-0 pointer-events-none'>
          <div className='absolute w-3 h-3 rounded-full bg-amber-400/20 top-[20%] left-[15%] animate-float-slow' style={{animationDuration: '8s'}} />
          <div className='absolute w-2 h-2 rounded-full bg-yellow-400/20 top-[40%] right-[20%] animate-float-drift' style={{animationDuration: '11s', animationDelay: '1s'}} />
          <div className='absolute w-1.5 h-1.5 rounded-full bg-orange-400/15 bottom-[30%] left-[30%] animate-float' style={{animationDuration: '6s'}} />
        </div>
        <div className='max-w-4xl mx-auto text-center relative z-10'>
          <h2 className='text-3xl sm:text-4xl font-black text-white mb-4'>
            ¿Listo para <span className='bg-gradient-to-r from-cyan-300 to-indigo-300 bg-clip-text text-transparent'>SYNAP</span>?
          </h2>
          <p className='text-slate-300 text-lg mb-8 max-w-2xl mx-auto'>
            Regístrate en segundos y disfruta de tus saltos, juegos y diversión sin filas. Tecnología <span className='text-cyan-300 font-semibold'>VERSA.JS</span>.
          </p>
          <button onClick={() => { setView('kiosk'); setKiosk(p => ({...p, sede: p.sede || sedes[0] || ''})) }} className='k-btn-gold text-lg px-10 py-4 scale-in'>
            Quiero registrarme ahora
          </button>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      {renderFooter()}

      {/* ─── TOAST ─── */}
      {message.text && (
        <div className={`toast-msg ${message.type}`}>{message.text}</div>
      )}
    </>
  )

  // ─── RENDER: Kiosk ───
  const renderKiosk = () => (
    <div className='ninja-bg min-h-screen p-4 sm:p-8'>
      <div className='max-w-3xl mx-auto glass rounded-3xl p-6 sm:p-10'>
        <div className='flex items-center justify-between mb-6'>
          <div className='flex items-center gap-2'>
            <div className='w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center text-white font-black text-xs'>S</div>
            <h2 className='text-2xl sm:text-3xl font-black text-white'>Kiosko SYNAP</h2>
          </div>
          <button onClick={() => { stopCamera(); setView('welcome') }} className='text-white/70 hover:text-white text-sm'>← Volver</button>
        </div>

        {/* Steps */}
        <div className='flex items-center gap-2 mb-8'>
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className='flex items-center gap-2'>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${kioskStep >= step ? 'bg-gradient-to-br from-cyan-400 to-indigo-500 text-white shadow-lg shadow-cyan-500/25' : 'bg-white/10 text-white/50'}`}>
                {step}
              </div>
              {step < 4 && <div className={`w-8 sm:w-14 h-1 rounded transition-all ${kioskStep > step ? 'bg-gradient-to-r from-cyan-400 to-indigo-500' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {kioskStep === 1 && (
          <div className='space-y-4 animate-fade-up'>
            <h3 className='text-white text-2xl font-bold'>Paso 1: Identificación</h3>
            <p className='text-slate-300 text-sm'>Ingresa tu cédula y selecciona la sede donde ingresarás.</p>
            <input className='k-input' placeholder='Número de cédula' value={kiosk.cedula} onChange={(e) => setKiosk((p) => ({ ...p, cedula: e.target.value.replace(/\D/g, '') }))} />
            <select className='k-input' value={kiosk.sede} onChange={(e) => setKiosk((p) => ({ ...p, sede: e.target.value }))}>
              <option value=''>Selecciona una sede</option>
              {sedes.map((sede) => <option key={sede} value={sede}>{sede}</option>)}
            </select>
            <button onClick={kioskStart} disabled={loading} className='k-btn-primary w-full'>{loading ? 'Validando...' : 'Continuar →'}</button>
          </div>
        )}

        {/* Step 2 */}
        {kioskStep === 2 && (
          <div className='space-y-4 animate-fade-up'>
            <h3 className='text-white text-2xl font-bold'>Paso 2: Tus datos</h3>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              <input className='k-input' placeholder='Nombre *' value={kiosk.nombre} onChange={(e) => setKiosk((p) => ({ ...p, nombre: e.target.value }))} />
              <input className='k-input' placeholder='Apellido *' value={kiosk.apellido} onChange={(e) => setKiosk((p) => ({ ...p, apellido: e.target.value }))} />
              <input type='date' className='k-input' value={kiosk.fecha_nacimiento} onChange={(e) => setKiosk((p) => ({ ...p, fecha_nacimiento: e.target.value }))} />
              <input type='email' className='k-input' placeholder='Correo electrónico' value={kiosk.email} onChange={(e) => setKiosk((p) => ({ ...p, email: e.target.value }))} />
              <input className='k-input sm:col-span-2' placeholder='Número de celular' value={kiosk.celular} onChange={(e) => setKiosk((p) => ({ ...p, celular: e.target.value }))} />
            </div>
            <div className='flex gap-3'>
              <button onClick={() => setKioskStep(1)} className='k-btn-soft flex-1'>← Atrás</button>
              <button onClick={kioskToStep3} className='k-btn-primary flex-1'>Siguiente →</button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {kioskStep === 3 && (
          <div className='space-y-4 animate-fade-up'>
            <h3 className='text-white text-2xl font-bold'>Paso 3: Acompañantes</h3>
            <p className='text-slate-300 text-sm'>¿Cuántos menores o acompañantes ingresan contigo?</p>
            <input type='number' min='0' className='k-input' placeholder='Cantidad de acompañantes' value={kioskRepresentadosCount} onChange={(e) => updateRepresentadosCount(e.target.value)} />
            {kioskRepresentados.map((rep, index) => (
              <div key={index} className='p-4 rounded-2xl bg-white/10 border border-white/15'>
                <p className='text-white font-semibold mb-2'>Acompañante #{index + 1}</p>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                  <input className='k-input' placeholder='Nombre' value={rep.nombre} onChange={(e) => { const next = [...kioskRepresentados]; next[index].nombre = e.target.value; setKioskRepresentados(next) }} />
                  <input type='date' className='k-input' value={rep.fecha_nacimiento} onChange={(e) => { const next = [...kioskRepresentados]; next[index].fecha_nacimiento = e.target.value; setKioskRepresentados(next) }} />
                </div>
              </div>
            ))}
            <div className='flex gap-3'>
              <button onClick={() => setKioskStep(2)} className='k-btn-soft flex-1'>← Atrás</button>
              <button onClick={kioskToStep4} className='k-btn-primary flex-1'>Siguiente: Foto →</button>
            </div>
          </div>
        )}

        {/* Step 4 */}
        {kioskStep === 4 && (
          <div className='space-y-4 animate-fade-up'>
            <h3 className='text-white text-2xl font-bold'>Paso 4: Foto</h3>
            <p className='text-slate-300 text-sm'>Toma una foto para tu perfil o puedes omitir este paso.</p>
            {!kioskPhoto && (
              <>
                <div className='relative rounded-3xl overflow-hidden border border-white/15 bg-slate-900'>
                  <video ref={videoRef} autoPlay playsInline muted className='w-full aspect-square object-cover' />
                  {!cameraActive && <div className='absolute inset-0 flex items-center justify-center text-white/60 text-sm'>Iniciando cámara...</div>}
                </div>
                <button onClick={capturePhoto} disabled={!cameraActive} className='k-btn-primary w-full disabled:opacity-50'>Tomar foto</button>
              </>
            )}
            {kioskPhoto && (
              <>
                <img src={kioskPhoto} alt='captura' className='w-full max-w-sm mx-auto rounded-3xl border-4 border-cyan-400/80 shadow-xl shadow-cyan-500/20' />
                <div className='flex gap-3'>
                  <button onClick={() => { setKioskPhoto(null); startCamera() }} className='k-btn-soft flex-1'>Repetir</button>
                  <button onClick={() => submitKiosk(false)} disabled={loading} className='k-btn-primary flex-1'>{loading ? 'Guardando...' : '✓ Guardar y Finalizar'}</button>
                </div>
              </>
            )}
            <button onClick={() => submitKiosk(true)} disabled={loading} className='text-slate-300 hover:text-white underline w-full text-sm transition'>Omitir foto y finalizar</button>
          </div>
        )}
      </div>

      {/* Toast */}
      {message.text && (
        <div className={`toast-msg ${message.type}`}>{message.text}</div>
      )}
    </div>
  )

  // ─── RENDER: Admin Login ───
  const renderAdminLogin = () => (
    <div className='ninja-bg min-h-screen p-6 flex items-center justify-center'>
      <div className='glass-dark rounded-3xl p-8 w-full max-w-md animate-scale-in'>
        <div className='flex items-center justify-center gap-2 mb-4'>
          <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 via-indigo-500 to-purple-600 flex items-center justify-center text-white font-black shadow-lg shadow-cyan-500/25'>S</div>
        </div>
        <h2 className='text-3xl font-black text-white text-center mb-1'>Acceso Administrativo</h2>
        <p className='text-slate-400 text-center text-sm mb-8'>Panel de control SYNAP — Ninja Park</p>

        <form onSubmit={adminLogin} className='space-y-4'>
          <input className='k-input' placeholder='Usuario' value={loginForm.username} onChange={(e) => setLoginForm((p) => ({ ...p, username: e.target.value }))} />
          <input type='password' className='k-input' placeholder='Contraseña' value={loginForm.password} onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))} />
          <button disabled={loading} className='k-btn-primary w-full text-lg'>{loading ? 'Ingresando...' : 'Ingresar'}</button>
        </form>

        <button onClick={() => setView('welcome')} className='mt-6 text-slate-400 hover:text-white text-sm w-full text-center transition'>← Volver al inicio</button>
      </div>

      {message.text && (
        <div className={`toast-msg ${message.type}`}>{message.text}</div>
      )}
    </div>
  )

  // ─── RENDER: Admin Panel ───
  const renderAdmin = () => (
    <div className='ninja-bg min-h-screen p-3 sm:p-6'>
      <div className='max-w-7xl mx-auto glass rounded-3xl p-4 sm:p-6 animate-fade-in'>
        {/* Header */}
        <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-5'>
          <div className='flex items-center gap-3'>
            <div className='w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 via-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-cyan-500/25'>S</div>
            <div>
              <h2 className='text-2xl sm:text-3xl font-black text-white leading-none'>SYNAP Admin</h2>
              <p className='text-slate-400 text-xs'>
                {adminUser?.username} · <span className='text-cyan-300 font-semibold'>{adminUser?.role?.toUpperCase()}</span>
                {adminUser?.sede && ` · ${adminUser.sede}`}
                {adminUser?.role === 'master' && ' · Acceso total'}
              </p>
            </div>
          </div>
          <div className='flex gap-2 flex-wrap'>
            <button onClick={() => { setAdminTab('dashboard'); fetchRecords(1) }} className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${adminTab === 'dashboard' ? 'bg-cyan-400 text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'}`}>Dashboard</button>
            <button onClick={() => { setAdminTab('registros'); fetchRecords(1) }} className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${adminTab === 'registros' ? 'bg-cyan-400 text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'}`}>Registros</button>
            <button onClick={adminLogout} className='px-4 py-2 rounded-xl text-sm font-semibold bg-rose-500/80 text-white hover:bg-rose-500 transition'>Salir</button>
          </div>
        </div>

        {/* Dashboard Tab */}
        {adminTab === 'dashboard' && (
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-up'>
            {/* POS */}
            <div className='glass rounded-2xl p-5'>
              <h3 className='text-xl font-bold text-white mb-1'>POS Autocompletado</h3>
              <p className='text-slate-400 text-xs mb-4'>Busca clientes por cédula para facturación en caja.</p>
              <div className='flex gap-2'>
                <input className='k-input' placeholder='Cédula' value={posCedula} onChange={(e) => setPosCedula(e.target.value.replace(/\D/g, ''))} />
                <button onClick={posLookup} disabled={loading} className='k-btn-primary whitespace-nowrap'>{loading ? '...' : 'Buscar'}</button>
              </div>
              {posResult && (
                <div className='mt-4 glass-dark rounded-xl p-4 text-sm text-slate-100 space-y-1'>
                  <p className='text-white font-bold'>{posResult.nombre} {posResult.apellido}</p>
                  <p className='text-slate-300'>{posResult.email || '-'} · {posResult.celular || '-'}</p>
                  <p className='text-slate-400'>{posResult.sede || '-'} · {posResult.representados_count || 0} acompañante(s)</p>
                </div>
              )}
            </div>

            {/* Billing */}
            <div className='glass rounded-2xl p-5'>
              <h3 className='text-xl font-bold text-white mb-1'>Facturación en Tiempo Real</h3>
              <p className='text-slate-400 text-xs mb-4'>Consulta y simula eventos de pago.</p>
              <div className='flex gap-2'>
                <input className='k-input' placeholder='Cédula' value={billingCedula} onChange={(e) => setBillingCedula(e.target.value.replace(/\D/g, ''))} />
                <button onClick={billingLookup} disabled={loading} className='k-btn-primary whitespace-nowrap'>{loading ? '...' : 'Consultar'}</button>
              </div>
              {billingResult && (
                <div className='mt-4 glass-dark rounded-xl p-4 text-sm text-slate-100 space-y-2'>
                  <p><span className='text-white font-bold'>{billingResult.nombre} {billingResult.apellido}</span></p>
                  <p>Monto sugerido: <strong className='text-emerald-300'>${billingResult.amount_suggested} {billingResult.currency}</strong></p>
                  <div className='flex gap-2'>
                    <button onClick={() => sendBillingWebhook('approved')} className='k-btn-sm rounded-lg bg-emerald-500 text-white'>Aprobado</button>
                    <button onClick={() => sendBillingWebhook('pending')} className='k-btn-sm rounded-lg bg-orange-500 text-white'>Pendiente</button>
                    <button onClick={() => sendBillingWebhook('rejected')} className='k-btn-sm rounded-lg bg-rose-500 text-white'>Rechazado</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Registros Tab */}
        {adminTab === 'registros' && (
          <div className='space-y-4 animate-fade-up'>
            {/* Filters */}
            <div className='grid grid-cols-1 md:grid-cols-5 gap-3'>
              <input className='k-input md:col-span-2' placeholder='Buscar por cédula o nombre...' value={recordsQuery} onChange={(e) => setRecordsQuery(e.target.value)} />
              {adminUser?.role === 'master' && (
                <select className='k-input' value={recordsSede} onChange={(e) => { setRecordsSede(e.target.value) }}>
                  <option value=''>Todas las sedes</option>
                  {sedes.map((sede) => <option key={sede} value={sede}>{sede}</option>)}
                </select>
              )}
              <select className='k-input' value={recordsLimit} onChange={(e) => setRecordsLimit(Number.parseInt(e.target.value, 10))}>
                <option value={10}>10 por página</option>
                <option value={20}>20 por página</option>
                <option value={50}>50 por página</option>
              </select>
              <button onClick={() => fetchRecords(1)} className='k-btn-primary'>Buscar</button>
            </div>

            {/* Export */}
            <div className='flex gap-2 flex-wrap'>
              <button onClick={() => exportRecords('csv', 'all')} className='k-btn-soft k-btn-sm'>CSV Todo</button>
              <button onClick={() => exportRecords('xlsx', 'all')} className='k-btn-soft k-btn-sm'>XLSX Todo</button>
              <button onClick={() => exportRecords('csv', 'page')} className='k-btn-soft k-btn-sm'>CSV Página</button>
              <button onClick={() => exportRecords('xlsx', 'page')} className='k-btn-soft k-btn-sm'>XLSX Página</button>
              <span className='text-slate-400 text-xs self-center ml-auto'>Actualizado cada 10s · {recordsTotal} registros</span>
            </div>

            {/* Table */}
            <div className='overflow-auto border border-white/10 rounded-2xl'>
              <table className='w-full min-w-[1000px] text-sm text-slate-100'>
                <thead>
                  <tr className='bg-white/10 text-slate-300 text-xs uppercase tracking-wider'>
                    <th className='text-left py-3 px-3 font-semibold'>Sede</th>
                    <th className='text-left py-3 px-3 font-semibold'>Cédula</th>
                    <th className='text-left py-3 px-3 font-semibold'>Nombre</th>
                    <th className='text-left py-3 px-3 font-semibold'>Apellido</th>
                    <th className='text-left py-3 px-3 font-semibold'>Email</th>
                    <th className='text-left py-3 px-3 font-semibold'>Celular</th>
                    <th className='text-left py-3 px-3 font-semibold'>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && records.length === 0 ? (
                    <>{Array.from({length:3}).map((_,i) => <SkeletonRow key={i} />)}</>
                  ) : records.length === 0 ? (
                    <tr><td colSpan={7} className='text-center py-8 text-slate-400'>Sin registros encontrados</td></tr>
                  ) : (
                    records.map((row) => (
                      <tr key={row.id} className='border-t border-white/5 hover:bg-white/5 transition'>
                        <td className='py-3 px-3'>{row.sede || '-'}</td>
                        <td className='py-3 px-3 font-mono'>{row.cedula || '-'}</td>
                        <td className='py-3 px-3'>{row.nombre || '-'}</td>
                        <td className='py-3 px-3'>{row.apellido || '-'}</td>
                        <td className='py-3 px-3 text-slate-300'>{row.email || '-'}</td>
                        <td className='py-3 px-3'>{row.celular || '-'}</td>
                        <td className='py-3 px-3'>
                          <button onClick={() => setEditRecord({ ...row })} className='k-btn-soft k-btn-sm'>Editar</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className='flex items-center justify-between text-slate-300 text-sm'>
              <p>Total: <strong className='text-white'>{recordsTotal}</strong> registros</p>
              <div className='flex items-center gap-2'>
                <button onClick={() => fetchRecords(Math.max(1, recordsPage - 1))} className='k-btn-soft k-btn-sm' disabled={recordsPage <= 1}>← Anterior</button>
                <span className='text-slate-400'>Pág. <strong className='text-white'>{recordsPage}</strong> de {recordsPages}</span>
                <button onClick={() => fetchRecords(Math.min(recordsPages, recordsPage + 1))} className='k-btn-soft k-btn-sm' disabled={recordsPage >= recordsPages}>Siguiente →</button>
              </div>
            </div>
          </div>
        )}

        {/* Billing events table */}
        {billingEvents.length > 0 && adminTab === 'dashboard' && (
          <div className='mt-5 glass rounded-2xl p-4 animate-fade-up'>
            <h4 className='text-white font-bold mb-3'>Últimos eventos de facturación</h4>
            <div className='overflow-auto'>
              <table className='w-full min-w-[600px] text-xs text-slate-100'>
                <thead className='bg-white/5'>
                  <tr>
                    <th className='text-left py-2 px-2 font-semibold'>Fecha</th>
                    <th className='text-left py-2 px-2 font-semibold'>Cédula</th>
                    <th className='text-left py-2 px-2 font-semibold'>Evento</th>
                    <th className='text-left py-2 px-2 font-semibold'>Estado</th>
                    <th className='text-left py-2 px-2 font-semibold'>Monto</th>
                    <th className='text-left py-2 px-2 font-semibold'>Sede</th>
                  </tr>
                </thead>
                <tbody>
                  {billingEvents.map((ev) => (
                    <tr key={ev.id} className='border-t border-white/5'>
                      <td className='py-2 px-2'>{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : '-'}</td>
                      <td className='py-2 px-2 font-mono'>{ev.cedula}</td>
                      <td className='py-2 px-2'>{ev.event_type}</td>
                      <td className='py-2 px-2'>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          ev.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300' :
                          ev.status === 'pending' ? 'bg-orange-500/20 text-orange-300' :
                          ev.status === 'rejected' ? 'bg-rose-500/20 text-rose-300' :
                          'bg-slate-500/20 text-slate-300'
                        }`}>{ev.status}</span>
                      </td>
                      <td className='py-2 px-2'>{ev.amount != null ? `$${ev.amount}` : '-'}</td>
                      <td className='py-2 px-2'>{ev.sede || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editRecord && (
        <div className='fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in'>
          <div className='glass rounded-2xl p-6 w-full max-w-lg animate-scale-in'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-white text-2xl font-bold'>Editar Registro</h3>
              <span className='text-slate-400 text-sm'>ID: #{editRecord.id}</span>
            </div>
            <div className='grid grid-cols-1 gap-3'>
              <div className='grid grid-cols-2 gap-3'>
                <input className='k-input' placeholder='Nombre' value={editRecord.nombre || ''} onChange={(e) => setEditRecord((p) => ({ ...p, nombre: e.target.value }))} />
                <input className='k-input' placeholder='Apellido' value={editRecord.apellido || ''} onChange={(e) => setEditRecord((p) => ({ ...p, apellido: e.target.value }))} />
              </div>
              <input className='k-input' placeholder='Email' value={editRecord.email || ''} onChange={(e) => setEditRecord((p) => ({ ...p, email: e.target.value }))} />
              <input className='k-input' placeholder='Celular' value={editRecord.celular || ''} onChange={(e) => setEditRecord((p) => ({ ...p, celular: e.target.value }))} />
              <input type='date' className='k-input' value={editRecord.fecha_nacimiento || ''} onChange={(e) => setEditRecord((p) => ({ ...p, fecha_nacimiento: e.target.value }))} />
              {adminUser?.role === 'master' && (
                <select className='k-input' value={editRecord.sede || ''} onChange={(e) => setEditRecord((p) => ({ ...p, sede: e.target.value }))}>
                  <option value=''>Selecciona sede</option>
                  {sedes.map((sede) => <option key={sede} value={sede}>{sede}</option>)}
                </select>
              )}
            </div>
            <div className='flex justify-end gap-2 mt-5'>
              <button onClick={() => setEditRecord(null)} className='k-btn-soft'>Cancelar</button>
              <button onClick={saveEditRecord} disabled={loading} className='k-btn-primary'>{loading ? 'Guardando...' : 'Guardar Cambios'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {message.text && (
        <div className={`toast-msg ${message.type}`}>{message.text}</div>
      )}
    </div>
  )

  // ─── Router ───
  if (view === 'kiosk') return renderKiosk()
  if (view === 'admin-login') return renderAdminLogin()
  if (view === 'admin') {
    if (!adminUser) return renderAdminLogin()
    return renderAdmin()
  }
  return renderWelcome()
}

export default App

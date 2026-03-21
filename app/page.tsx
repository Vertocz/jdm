// app/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchCandidats } from "@/app/hooks/useSearchCandidats";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useSupabaseAuth } from "@/app/hooks/useSupabaseAuth";
import { useSignup } from "@/app/hooks/useSignUp";
import CandidatCardModal from "@/app/components/CandidatCardModal";
import { calculAge, pointsPourAge, formatNomCarte, formatFr } from "@/utils/fonctions";
import { CandidatRecherche } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────
type Persona = { id: number; nom: string; ddn: string | null; ddd: string | null; photo?: string };

// ── Fallback si Supabase vide ──────────────────────────────────────────────
const FALLBACK: Persona[] = [
  { id: 42, nom: "Françoise Hardy",        ddn: "1944-01-17", ddd: null,         photo: "Françoise_Hardy_-_1962.jpg" },
  { id: 7,  nom: "Michel Piccoli",         ddn: "1925-12-27", ddd: "2020-05-12", photo: "Michel_Piccoli_(2010).jpg" },
  { id: 18, nom: "Jane Fonda",             ddn: "1937-12-21", ddd: null,         photo: "Jane_Fonda_(2019).jpg" },
  { id: 31, nom: "Jean-Paul Belmondo",     ddn: "1933-04-09", ddd: "2021-09-06", photo: "Jean-Paul_Belmondo.jpg" },
  { id: 55, nom: "Brigitte Bardot",        ddn: "1934-09-28", ddd: null,         photo: "Brigitte_Bardot_(1968).jpg" },
  { id: 12, nom: "Alain Delon",            ddn: "1935-11-08", ddd: "2024-08-18", photo: "Alain_Delon_(1962).jpg" },
  { id: 63, nom: "Catherine Deneuve",      ddn: "1943-10-22", ddd: null,         photo: "Catherine_Deneuve_Césars_2021.jpg" },
  { id: 29, nom: "Jean-Louis Trintignant", ddn: "1930-12-11", ddd: "2022-06-17", photo: "Jean-Louis_Trintignant_(2015).jpg" },
];

function photoUrl(f: string) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f.replace(/ /g, "_"))}`;
}

/* ══ Carte résultat de recherche ══════════════════════════════════════════ */
function SearchResultCard({ candidat, onClick, animDelay }: {
  candidat: CandidatRecherche; onClick: () => void; animDelay: number;
}) {
  const age = calculAge(candidat.ddn, null);
  const pts = pointsPourAge(age);
  const { display, fontSize, letterSpacing } = formatNomCarte(candidat.nom);
  const photo = candidat.photo
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(candidat.photo.replace(/ /g, "_"))}`
    : null;
  return (
    <div onClick={onClick} style={{ cursor:"pointer", opacity:0, transform:"translateY(20px) scale(.96)", animation:`srCardIn .35s cubic-bezier(.23,1,.32,1) ${animDelay}ms forwards` }}>
      <div className="panini-card" style={{ transition:"transform .3s cubic-bezier(.23,1,.32,1), box-shadow .3s ease" }}
        onMouseOver={e=>{const el=e.currentTarget as HTMLElement;el.style.transform="translateY(-10px) scale(1.025)";el.style.boxShadow="0 12px 40px rgba(219,135,143,.25), 0 30px 80px rgba(0,0,0,.5)";}}
        onMouseOut={e=>{const el=e.currentTarget as HTMLElement;el.style.transform="";el.style.boxShadow="";}}
      >
        <div className="pc-bg" />
        <div className="pc-strip"><span className="pc-vname" style={{ fontSize, letterSpacing }}>{display}</span></div>
        <span className="pc-serial">#{String(candidat.wikidata_id?.replace("Q","") ?? "0").padStart(4,"0")}</span>
        <div className="pc-photo-zone">
          <div className="pc-placeholder" id={`sr-ph-${candidat.id}`}>◆</div>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={candidat.nom}
              onLoad={e=>{(e.target as HTMLImageElement).style.display="block";const ph=document.getElementById(`sr-ph-${candidat.id}`);if(ph)ph.style.display="none";}}
              onError={e=>{(e.target as HTMLImageElement).style.display="none";}}
              style={{display:"none",position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"center top"}}
            />
          )}
        </div>
        <div className="pc-pts"><span className="pn">{pts}</span><span className="pl">pts</span></div>
        <div className="pc-info">
          <div className="pc-dates"><div className="pc-date-item"><span className="pc-date-lbl">Naissance</span><span className="pc-date-val">{formatFr(candidat.ddn)}</span></div></div>
          {age !== null && <div className="pc-age">{age} ans</div>}
          {candidat.description && (
            <p style={{fontFamily:"'Outfit',sans-serif",fontSize:".5rem",fontWeight:300,color:"rgba(241,235,219,.38)",fontStyle:"italic",lineHeight:1.4,marginTop:3,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"} as React.CSSProperties}>
              {candidat.description.charAt(0).toUpperCase() + candidat.description.slice(1)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══ Overlay de recherche ══════════════════════════════════════════════════ */
function SearchOverlay({ onSelect, onClose }: { onSelect: (c: CandidatRecherche) => void; onClose: () => void; }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { suggestions, loading } = useSearchCandidats(query);

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 50); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <>
      <style>{`
        @keyframes srOverlayIn{from{opacity:0}to{opacity:1}}
        @keyframes srPanelIn{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes srCardIn{from{opacity:0;transform:translateY(20px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
        .sr-hero{outline:none}.sr-hero::placeholder{color:rgba(241,235,219,.25)}
      `}</style>
      <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:1100,background:"rgba(8,8,16,.92)",backdropFilter:"blur(12px)",animation:"srOverlayIn .25s ease forwards"}} />
      <div style={{position:"fixed",top:0,left:0,right:0,zIndex:1200,display:"flex",flexDirection:"column",alignItems:"center",paddingTop:80,animation:"srPanelIn .3s cubic-bezier(.23,1,.32,1) forwards",pointerEvents:"none"}}>
        <div style={{width:"100%",maxWidth:680,padding:"0 24px",pointerEvents:"auto"}} onClick={e=>e.stopPropagation()}>
          <div style={{position:"relative"}}>
            {query && <div style={{position:"absolute",top:"50%",left:0,right:48,transform:"translateY(-50%)",fontFamily:"'Outfit',sans-serif",fontSize:"clamp(2.5rem,8vw,5rem)",fontWeight:900,letterSpacing:"-2px",color:"rgba(241,235,219,.04)",pointerEvents:"none",userSelect:"none",overflow:"hidden",whiteSpace:"nowrap"}}>{query}</div>}
            <input ref={inputRef} className="sr-hero" type="text" value={query} onChange={e=>setQuery(e.target.value)}
              placeholder="Rechercher une personnalité vivante…" autoComplete="off"
              style={{width:"100%",padding:"20px 56px 20px 0",fontFamily:"'Outfit',sans-serif",fontSize:"clamp(1.4rem,4vw,2.2rem)",fontWeight:700,letterSpacing:"-0.5px",background:"transparent",border:"none",borderBottom:"2px solid rgba(219,135,143,.4)",color:"var(--cream)",caretColor:"var(--rose)"}}
            />
            <div style={{position:"absolute",right:4,top:"50%",transform:"translateY(-50%)"}}>
              {loading
                ? <div style={{width:20,height:20,border:"2px solid rgba(219,135,143,.25)",borderTopColor:"var(--rose)",borderRadius:"50%",animation:"hSpin .7s linear infinite"}}/>
                : <span style={{color:"rgba(241,235,219,.2)",fontSize:"1.4rem"}}>⌕</span>
              }
            </div>
          </div>
          <p style={{fontFamily:"'Outfit',sans-serif",fontSize:".62rem",fontWeight:300,letterSpacing:"2px",textTransform:"uppercase",color:"rgba(241,235,219,.2)",marginTop:10,textAlign:"right"}}>Échap pour fermer</p>
        </div>
        {query.trim().length >= 2 && (
          <div style={{pointerEvents:"auto",width:"100%",marginTop:32}} onClick={e=>e.stopPropagation()}>
            {suggestions.length > 0 ? (
              <div style={{display:"flex",flexWrap:"wrap",gap:20,justifyContent:"center",padding:"0 24px 60px",maxWidth:1200,margin:"0 auto"}}>
                {suggestions.map((c,i) => <SearchResultCard key={c.id} candidat={c} onClick={()=>{onSelect(c);onClose();}} animDelay={i*60} />)}
              </div>
            ) : !loading && (
              <p style={{fontFamily:"'Outfit',sans-serif",fontSize:".78rem",fontWeight:300,letterSpacing:"2px",textTransform:"uppercase",color:"rgba(241,235,219,.25)",textAlign:"center",marginTop:40}}>
                Aucune personnalité vivante trouvée
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Carte Panini ───────────────────────────────────────────────────────────
function PaniniCard({ persona }: { persona: Persona }) {
  const age  = calculAge(persona.ddn, persona.ddd);
  const pts  = pointsPourAge(age);
  const ser  = "#" + String(persona.id).padStart(4, "0");
  const dead = !!persona.ddd;
  const { display, fontSize, letterSpacing } = formatNomCarte(persona.nom);

  return (
    <div className={`panini-card${dead ? " dead" : ""}`}>
      <div className="pc-bg" />
      <div className="pc-strip">
        <span className="pc-vname" style={{ fontSize, letterSpacing }}>{display}</span>
      </div>
      <span className="pc-serial">{ser}</span>
      <div className="pc-photo-zone">
        <div className="pc-placeholder" id={`ph-${persona.id}-${ser}`}>◆</div>
        {persona.photo && (
          <img
            src={photoUrl(persona.photo)}
            alt={persona.nom}
            onLoad={e => {
              (e.target as HTMLImageElement).style.display = "block";
              const ph = document.getElementById(`ph-${persona.id}-${ser}`);
              if (ph) ph.style.display = "none";
            }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            style={{ display: "none" }}
          />
        )}
      </div>
      <div className="pc-pts">
        <span className="pn">{pts}</span>
        <span className="pl">pts</span>
      </div>
      <div className="pc-info">
        <div className="pc-dates">
          <div className="pc-date-item">
            <span className="pc-date-lbl">Naissance</span>
            <span className="pc-date-val">{formatFr(persona.ddn)}</span>
          </div>
          {persona.ddd && (
            <>
              <span className="pc-sep">→</span>
              <div className="pc-date-item">
                <span className="pc-date-lbl">Décès</span>
                <span className="pc-date-val">{formatFr(persona.ddd)}</span>
              </div>
            </>
          )}
        </div>
        {age !== null && <div className="pc-age">{age} ans</div>}
      </div>
    </div>
  );
}

// ── PAGE ───────────────────────────────────────────────────────────────────
export default function HomePage() {
  const router    = useRouter();
  const { user }  = useSupabaseAuth();
  const { signup, loading: signupLoading } = useSignup();

  // Carte animée
  const [personas,   setPersonas]   = useState<Persona[]>(FALLBACK);
  const [renderTick, setRenderTick] = useState(0); // déclenche un re-render quand un slot change de persona

  // Nav
  const [scrolled,   setScrolled]   = useState(false);
  const [burgerOpen, setBurgerOpen] = useState(false);

  // Auth drawer
  const [authOpen,    setAuthOpen]    = useState(false);
  const [authMode,    setAuthMode]    = useState<"signin" | "signup">("signin");
  const [authEmail,   setAuthEmail]   = useState("");
  const [authPwd,     setAuthPwd]     = useState("");
  const [authConfirm, setAuthConfirm] = useState("");
  const [authName,    setAuthName]    = useState("");
  const [authError,   setAuthError]   = useState("");

  // Recherche
  const [searchOpen, setSearchOpen] = useState(false);

  // Modal carte
  const [modalCand, setModalCand] = useState<CandidatRecherche | null>(null);

  // Refs
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const heroRef     = useRef<HTMLElement>(null);
  const mouseRef    = useRef({ x: 0.5, y: 0.5 });
  const heroBgRef   = useRef<HTMLDivElement>(null);

  // ── Charger les personas depuis Supabase ──────────────────────────────────
  useEffect(() => {
    supabase
      .from("candidats")
      .select("id, nom, ddn, ddd, photo")
      // On ne met pas de .order("id")
      .limit(50) // On en prend un plus gros paquet
      .then(({ data }) => {
        if (data && data.length >= 4) {
          // On mélange le tableau en JS (Algorithme de Fisher-Yates ou simple sort)
          const shuffled = [...data].sort(() => Math.random() - 0.5);
          // On ne garde que les 12 premiers après mélange
          setPersonas(shuffled.slice(0, 12) as Persona[]);
        }
      });
  }, []);

  // ── Scroll nav ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // ── Fermer sur clic extérieur (recherche + burger) ────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const burger = document.getElementById("hBurger");
      const menu   = document.getElementById("hMobileMenu");
      if (burger && menu && !burger.contains(e.target as Node) && !menu.contains(e.target as Node)) {
        setBurgerOpen(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // ── Canvas étoiles ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const hero   = heroRef.current;
    if (!canvas || !hero) return;
    const ctx = canvas.getContext("2d")!;
    let W = 0, H = 0;
    const resize = () => { W = canvas.width = hero.offsetWidth; H = canvas.height = hero.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);

    const STARS = Array.from({ length: 180 }, (_, i) => {
      const bright = i < 10;
      return {
        x: Math.random(), y: Math.random(), ox: 0, oy: 0,
        r:     bright ? Math.random() * .65 + .45 : Math.random() * .5 + .12,
        base:  bright ? Math.random() * .28 + .1  : Math.random() * .1 + .025,
        phase: Math.random() * Math.PI * 2,
        spd:   Math.random() * .0007 + .0003,
        hue:   Math.random() < .14 ? "rgba(219,135,143," : "rgba(241,235,219,",
        bright,
      };
    });

    let t = 0, rafId: number;
    function draw() {
      ctx.clearRect(0, 0, W, H);
      t++;
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      STARS.forEach(s => {
        const alpha = s.base + Math.sin(t * s.spd * 60 + s.phase) * s.base * .55;
        const dx = (s.x + s.ox) - mx, dy = (s.y + s.oy) - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const radius = s.bright ? .22 : .14, strength = s.bright ? .0018 : .0007;
        if (dist < radius && dist > 0) { const f = (1 - dist / radius) * strength; s.ox += (dx / dist) * f; s.oy += (dy / dist) * f; }
        s.ox *= .94; s.oy *= .94;
        const px = (s.x + s.ox) * W, py = (s.y + s.oy) * H;
        if (s.bright && alpha > .15) {
          const g = ctx.createRadialGradient(px, py, 0, px, py, s.r * 4);
          g.addColorStop(0, s.hue + alpha * .35 + ")");
          g.addColorStop(1, s.hue + "0)");
          ctx.fillStyle = g;
          ctx.fillRect(px - s.r * 4, py - s.r * 4, s.r * 8, s.r * 8);
        }
        ctx.beginPath(); ctx.arc(px, py, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.hue + Math.max(0, alpha) + ")"; ctx.fill();
      });
      rafId = requestAnimationFrame(draw);
    }
    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(rafId); };
  }, []);

  // Animation gérée par rAF dans le bloc ci-dessous

  // ── Souris sur le hero (parallax + étoiles) ───────────────────────────────
  const handleHeroMouse = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top)  / r.height;
    mouseRef.current = { x: nx, y: ny };
    if (heroBgRef.current) {
      heroBgRef.current.style.background = `
        radial-gradient(ellipse 65% 55% at ${50 + (nx - .5) * 22}% ${50 + (ny - .5) * 18}%, rgba(219,135,143,.06) 0%, transparent 65%),
        radial-gradient(ellipse 55% 45% at 85% 20%, rgba(41,62,78,.3) 0%, transparent 50%),
        radial-gradient(ellipse 50% 40% at 80% 85%, rgba(78,57,41,.18) 0%, transparent 50%)`;
    }
  }, []);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const resetAuth = (mode: "signin" | "signup") => {
    setAuthMode(mode); setAuthError("");
    setAuthEmail(""); setAuthPwd(""); setAuthConfirm(""); setAuthName("");
  };

  const handleAuth = async () => {
    setAuthError("");
    if (authMode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPwd });
      if (error) { setAuthError("Email ou mot de passe incorrect"); return; }
      setAuthOpen(false);
      router.push("/salle-attente");
    } else {
      const result = await signup({ email: authEmail, password: authPwd, confirmPassword: authConfirm, displayName: authName });
      if (!result.success) { setAuthError(result.error ?? "Erreur"); return; }
      setAuthOpen(false);
      router.push("/salle-attente");
    }
  };

  const openAuth  = () => setAuthOpen(true);
  const closeAuth = () => setAuthOpen(false);

  // ── Recherche ─────────────────────────────────────────────────────────────
  const handleSelect = (c: CandidatRecherche) => {
    setSearchOpen(false); setModalCand(c);
  };

  // ── Refs pour l'animation rAF (lecture seule côté React) ────────────────
  const N_SLOTS      = 2;
  const cardEls      = useRef<(HTMLDivElement|null)[]>(Array.from({length: N_SLOTS}, () => null));
  const personaIdxR  = useRef<number[]>(Array.from({length: N_SLOTS}, (_, i) => i));
  const nextIdxR     = useRef(5);
  const cycleR       = useRef<number[]>(Array.from({length: N_SLOTS}, () => -1));
  const personasR    = useRef<Persona[]>([]);
  const rafTimeR     = useRef<number|null>(null);
  const timeR        = useRef(0);
  const rafIdR       = useRef<number | null>(null);

  // Garde personasR à jour
  useEffect(() => { personasR.current = personas; }, [personas]);

  // Init slots quand les personas changent
  useEffect(() => {
    if (!personas.length) return;
    personaIdxR.current = Array.from({length: N_SLOTS}, (_, i) => i % personas.length);
    nextIdxR.current    = N_SLOTS % personas.length;
    setRenderTick(t => t + 1);
  }, [personas.length]);

  // ── rAF : mouvement continu, courbe douce, personas par refs ─────────────
  useEffect(() => {
    const N        = N_SLOTS;
    const PERIOD   = N * 5000;   // ms pour un tour complet d'un slot
    const CONT_H   = 580;        // hauteur du conteneur
    const CARD_H   = 300;
    const BY       = CONT_H + CARD_H / 2 + 10;  // y entrée (sous le bas)
    const TY       = -CARD_H / 2 - 10;           // y sortie (au-dessus du haut)
    const X0       = 8;     // x de base (px depuis la gauche du conteneur)
    const XA       = 22;    // amplitude de l'arc horizontal
    const XB       = 10;    // dérive linéaire vers la droite
    const RMAX     = 2.8;   // rotation max en degrés

    function frame(t: number) {
      const dt = rafTimeR.current !== null ? t - rafTimeR.current : 0;
      rafTimeR.current = t;
      timeR.current   += dt;

      const pers = personasR.current;
      if (!pers.length) { rafIdR.current = requestAnimationFrame(frame); return; }

      for (let i = 0; i < N; i++) {
        const raw   = timeR.current / PERIOD + i / N;
        const p     = raw % 1;                    // phase 0→1 continue
        const cycle = Math.floor(raw);

        // Mise à jour persona quand le slot boucle (p ≈ 0, card invisible sous le fade)
        if (cycle !== cycleR.current[i]) {
          cycleR.current[i] = cycle;
          if (cycle > 0) {
            personaIdxR.current[i] = nextIdxR.current % pers.length;
            nextIdxR.current++;
            setRenderTick(tt => tt + 1);
          }
        }

        // Position sur la courbe
        const y   = BY + (TY - BY) * p;
        const x   = X0 + XA * Math.sin(p * Math.PI) + XB * p;
        const rot = RMAX * Math.cos(p * Math.PI);   // incliné à droite en bas, à gauche en haut

        const el = cardEls.current[i];
        if (el) el.style.transform = `translate(${x}px, ${y - CARD_H / 2}px) rotate(${rot}deg)`;
      }

      rafIdR.current = requestAnimationFrame(frame);
    }

    rafIdR.current = requestAnimationFrame(frame);
    return () => { if (rafIdR.current) cancelAnimationFrame(rafIdR.current); };
  }, []); // une seule fois — tout passe par des refs

  return (
    <>
      {/* ── OVERLAY DE RECHERCHE ── */}
      {searchOpen && (
        <SearchOverlay
          onSelect={c => setModalCand(c)}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {/* ── NAV ── */}
      <nav className={`h-nav${scrolled ? " scrolled" : ""}`}>
        <Link href="/" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <Image src="/logo.png" alt="Le Jeu de la Mort" width={72} height={72}
            style={{ objectFit: "contain" }} priority />
        </Link>

        <div className="h-nav-links">
          <Link href="/"            className={`h-nav-link${true ? " active" : ""}`}>Accueil</Link>
          <Link href="/classement"  className="h-nav-link">Classement</Link>
          <Link href="/in-memoriam" className="h-nav-link">In Memoriam</Link>
          <Link href="/favoris"     className="h-nav-link">Favoris</Link>
          {user && <Link href="/salle-attente" className="h-nav-link">Ma salle</Link>}
        </div>

        <div className="h-nav-actions">
          {user ? (
            <button className="h-nav-btn" onClick={() => { supabase.auth.signOut(); router.push("/"); }}>
              Déconnexion
            </button>
          ) : (
            <button className="h-nav-btn" onClick={openAuth}>Connexion</button>
          )}
        </div>

        <button id="hBurger" className={`h-burger${burgerOpen ? " open" : ""}`}
          onClick={() => setBurgerOpen(v => !v)} aria-label="Menu">
          <span /><span /><span />
        </button>
      </nav>

      {/* ── MENU MOBILE ── */}
      <div id="hMobileMenu" className={`h-mobile-menu${burgerOpen ? " open" : ""}`}>
        {[
          { href: "/",             label: "Accueil",     active: true },
          { href: "/classement",   label: "Classement",  active: false },
          { href: "/in-memoriam",  label: "In Memoriam", active: false },
          { href: "/favoris",      label: "Favoris",     active: false },
          ...(user ? [{ href: "/salle-attente", label: "Ma salle", active: false }] : []),
        ].map(({ href, label, active }) => (
          <Link key={href} href={href} onClick={() => setBurgerOpen(false)}
            className={`h-mobile-link${active ? " active" : ""}`}>
            {label}
          </Link>
        ))}
        <div className="h-mobile-sep" />
        {user ? (
          <button className="h-mobile-login" onClick={() => { setBurgerOpen(false); supabase.auth.signOut(); }}>
            Déconnexion
          </button>
        ) : (
          <button className="h-mobile-login" onClick={() => { setBurgerOpen(false); openAuth(); }}>
            Connexion / Inscription
          </button>
        )}
      </div>

      {/* ── AUTH DRAWER ── */}
      <div className={`h-auth-overlay${authOpen ? " open" : ""}`} onClick={closeAuth} />
      <aside className={`h-auth-drawer${authOpen ? " open" : ""}`}>
        <button className="h-auth-close" onClick={closeAuth}>✕</button>
        <div className="h-auth-inner">
          <div className="h-auth-heading">Bon<em>jour.</em></div>
          <p className="h-auth-sub">Connecte-toi pour gérer ta sélection</p>

          <div className="h-auth-tabs">
            {(["signin", "signup"] as const).map(m => (
              <button key={m} className={`h-auth-tab${authMode === m ? " active" : ""}`}
                onClick={() => resetAuth(m)}>
                {m === "signin" ? "Connexion" : "Inscription"}
              </button>
            ))}
          </div>

          {authError && <div className="h-auth-error">{authError}</div>}

          {authMode === "signup" && (
            <div className="h-auth-field">
              <label className="h-auth-label">Pseudo</label>
              <input className="h-auth-input" type="text" placeholder="3 caractères minimum"
                value={authName} onChange={e => setAuthName(e.target.value)} />
            </div>
          )}
          <div className="h-auth-field">
            <label className="h-auth-label">Email</label>
            <input className="h-auth-input" type="email" placeholder="ton@email.fr"
              value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
          </div>
          <div className="h-auth-field">
            <label className="h-auth-label">Mot de passe</label>
            <input className="h-auth-input" type="password" placeholder="6 caractères minimum"
              value={authPwd} onChange={e => setAuthPwd(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && authMode === "signin") handleAuth(); }} />
          </div>
          {authMode === "signup" && (
            <div className="h-auth-field">
              <label className="h-auth-label">Confirmer</label>
              <input className="h-auth-input" type="password" placeholder="••••••••"
                value={authConfirm} onChange={e => setAuthConfirm(e.target.value)} />
            </div>
          )}

          <button className="h-auth-submit" onClick={handleAuth} disabled={signupLoading}>
            {signupLoading ? "Chargement…" : authMode === "signin" ? "Se connecter" : "Créer mon compte"}
          </button>

          <p className="h-auth-footer">
            En jouant, tu acceptes que ce jeu est de mauvais goût et que c&apos;est exactement pour ça qu&apos;il existe.
          </p>
        </div>
      </aside>

      {/* ── HERO ── */}
      <section className="hero" ref={heroRef} onMouseMove={handleHeroMouse}>
        <canvas ref={canvasRef} id="star-canvas" />
        <div className="hero-bg" ref={heroBgRef} />

        {/* GAUCHE */}
        <div className="hero-left">
          <p className="eyebrow">Paris, célébrités &amp; mauvais goût assumé</p>
          <h1 className="hero-title">Le Jeu<br /><em>de la Mort</em></h1>
          <p className="hero-desc">
            Chaque année, tu constitues une équipe de personnalités vivantes.<br />
            Si l&apos;une d&apos;elles vient à disparaître, tu marques des points.<br />
            Plus la personnalité est jeune, plus les points sont élevés.
          </p>

          {/* Bouton recherche → overlay */}
          <button
            onClick={() => setSearchOpen(true)}
            className="search-input"
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              cursor: "pointer", textAlign: "left",
              color: "rgba(241,235,219,.3)",
              transition: "border-color .25s, background .25s",
            }}
            onMouseOver={e => {
              const el = e.currentTarget;
              el.style.borderColor = "rgba(219,135,143,.45)";
              el.style.background  = "rgba(241,235,219,.07)";
            }}
            onMouseOut={e => {
              const el = e.currentTarget;
              el.style.borderColor = "rgba(241,235,219,.15)";
              el.style.background  = "rgba(241,235,219,.05)";
            }}
          >
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: ".95rem", fontWeight: 400 }}>
              Rechercher une personnalité vivante…
            </span>
            <span style={{ color: "rgba(241,235,219,.2)", fontSize: "1.1rem" }}>⌕</span>
          </button>
        </div>

        {/* DROITE — flux continu de cartes sur une courbe douce, piloté par rAF */}
        <div className="hero-right">
          <div style={{
            position: "relative",
            width: 260,
            height: 580,
            overflow: "hidden",
            // Masque de fondu en haut et en bas (les cartes apparaissent/disparaissent naturellement)
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 20%, black 78%, transparent 100%)",
            maskImage:        "linear-gradient(to bottom, transparent 0%, black 20%, black 78%, transparent 100%)",
          }}>
            {Array.from({ length: N_SLOTS }, (_, i) => {
              const pers = personasR.current;
              const pidx = personaIdxR.current[i] ?? 0;
              const persona = (pers.length ? pers[pidx % pers.length] : null) ?? FALLBACK[i % FALLBACK.length];
              return (
                <div
                  key={i}
                  ref={el => { cardEls.current[i] = el; }}
                  style={{ position: "absolute", top: 0, left: 0, width: 210, willChange: "transform" }}
                >
                  <PaniniCard persona={persona} />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── MODAL CARTE ── */}
      {modalCand && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(8,8,16,.88)",
            backdropFilter: "blur(8px)",
            zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setModalCand(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}
            onClick={e => e.stopPropagation()}>
            <CandidatCardModal candidat={modalCand} onClose={() => setModalCand(null)} user={user} />
            <button
              onClick={() => setModalCand(null)}
              style={{
                padding: "9px 24px",
                background: "transparent",
                border: "1px solid rgba(241,235,219,.14)",
                borderRadius: 30,
                color: "rgba(241,235,219,.38)",
                fontFamily: "'Outfit', sans-serif",
                fontSize: ".7rem", fontWeight: 500,
                letterSpacing: 2, textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
}
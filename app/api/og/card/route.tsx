// app/api/og/card/route.tsx
//
// Génère la carte "panini" d'un candidat décédé sous forme d'image PNG,
// recalée sur les vraies valeurs de .panini-card.dead dans globals.css
// (dimensions x2 pour un rendu net en 210x300 CSS sur écrans retina).
//
// Usage : GET /api/og/card?id=137&nom=Philippe%20Bouvard&ddn=1929-02-13&ddd=2026-08-24&photo=Philippe_Bouvard_2018.jpg
// Test rapide : ouvrir l'URL ci-dessus directement dans le navigateur.

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { formatDate, calculAge, pointsPourAge, buildPhotoUrl, cardNameStyle } from '@/lib/deathCard';

export const runtime = 'edge';

// Place ces 2 fichiers dans app/api/og/card/fonts/ (télécharger sur
// https://fonts.google.com/specimen/Outfit)
const outfitBold = fetch(new URL('./fonts/Outfit-Bold.ttf', import.meta.url)).then(r => r.arrayBuffer());
const outfitSemiBold = fetch(new URL('./fonts/Outfit-SemiBold.ttf', import.meta.url)).then(r => r.arrayBuffer());

const CARD_W = 420; // 210 x2
const CARD_H = 600; // 300 x2
const STRIP_W = 68; // 34 x2
const PHOTO_H = 370; // 185 x2

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const nom = (searchParams.get('nom') ?? 'Inconnu').slice(0, 40);
  const ddn = searchParams.get('ddn');
  const ddd = searchParams.get('ddd');
  const photo = searchParams.get('photo');
  const id = searchParams.get('id') ?? '0';

  const age = calculAge(ddn, ddd);
  const pts = pointsPourAge(age);
  const serial = '#' + id.padStart(4, '0');
  const photoUrl = buildPhotoUrl(photo);
  const { fontSize: nameFontSize, letterSpacing: nameLetterSpacing } = cardNameStyle(nom);

  const [boldData, semiBoldData] = await Promise.all([outfitBold, outfitSemiBold]);

  return new ImageResponse(
    (
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          display: 'flex',
          position: 'relative',
          borderRadius: 32, // CSS: 16px
          overflow: 'hidden',
          fontFamily: 'Outfit',
          // .panini-card.dead .pc-bg
          background: 'linear-gradient(150deg, #1a1810 0%, #12100a 55%, #0a0908 100%)',
        }}
      >
        {/* .panini-card.dead .pc-bg::before — lueur radiale approximée (Satori gère mal la syntaxe ellipse complète) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            background:
              'radial-gradient(circle at 40% -5%, rgba(160,140,60,0.18), transparent 55%), radial-gradient(circle at 100% 105%, rgba(40,35,15,0.5), transparent 50%)',
          }}
        />

        {/* .panini-card.dead .pc-strip */}
        <div
          style={{
            position: 'relative',
            width: STRIP_W,
            height: CARD_H,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(180deg, rgba(160,140,90,0.85) 0%, rgba(110,95,55,0.75) 55%, rgba(60,50,25,0.85) 100%)',
          }}
        >
          {/* .pc-vname */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-90deg)',
              width: CARD_H,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: nameFontSize,
              fontWeight: 600,
              letterSpacing: nameLetterSpacing,
              color: 'rgba(255,255,255,0.9)',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            {nom}
          </div>
          {/* .pc-serial — en Outfit faute de Space Mono chargé ici */}
          <div
            style={{
              position: 'absolute',
              bottom: 20,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              fontSize: 12.8,
              letterSpacing: '1px',
              color: 'rgba(255,255,255,0.3)',
            }}
          >
            {serial}
          </div>
        </div>

        {/* Contenu (photo + badge + infos) */}
        <div style={{ position: 'relative', flex: 1, height: CARD_H, display: 'flex', flexDirection: 'column' }}>
          {/* .pc-photo-zone */}
          <div style={{ position: 'relative', width: '100%', height: PHOTO_H, display: 'flex', overflow: 'hidden' }}>
            {photoUrl ? (
              <img
                src={photoUrl}
                width={CARD_W - STRIP_W}
                height={PHOTO_H}
                style={{ objectFit: 'cover', objectPosition: 'center top', filter: 'grayscale(1) brightness(0.65)' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', background: '#3d1f28' }} />
            )}
            {/* .pc-photo-zone::after (dead) — fondu bas de photo */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 160, // 80px x2
                display: 'flex',
                background: 'linear-gradient(to top, #141208, transparent)',
              }}
            />
          </div>

          {/* .pc-pts */}
          <div
            style={{
              position: 'absolute',
              right: 22,
              top: 336,
              width: 80, // 40px x2
              height: 80,
              borderRadius: 40,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #c8af5a 0%, #a08c3a 100%)',
            }}
          >
            <div style={{ display: 'flex', fontSize: 32, fontWeight: 800, color: 'white', lineHeight: 1 }}>{pts}</div>
            <div
              style={{
                display: 'flex',
                fontSize: 12.16,
                fontWeight: 500,
                letterSpacing: '2px',
                color: 'rgba(255,255,255,0.72)',
                textTransform: 'uppercase',
              }}
            >
              {pts > 1 ? 'pts' : 'pt'}
            </div>
          </div>

          {/* .pc-info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 24px 26px 22px', marginTop: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div
                  style={{
                    display: 'flex',
                    fontSize: 14.08,
                    fontWeight: 300,
                    letterSpacing: '3px',
                    textTransform: 'uppercase',
                    color: 'rgba(219,135,143,0.5)',
                    lineHeight: 1,
                  }}
                >
                  Naissance
                </div>
                <div style={{ display: 'flex', fontSize: 22.4, fontWeight: 500, color: 'rgba(241,235,219,0.85)', lineHeight: 1 }}>
                  {formatDate(ddn)}
                </div>
              </div>
              {ddd && (
                <>
                  <div style={{ display: 'flex', fontSize: 17.6, color: 'rgba(219,135,143,0.3)', marginTop: 18 }}>→</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div
                      style={{
                        display: 'flex',
                        fontSize: 14.08,
                        fontWeight: 300,
                        letterSpacing: '3px',
                        textTransform: 'uppercase',
                        color: 'rgba(219,135,143,0.5)',
                        lineHeight: 1,
                      }}
                    >
                      Décès
                    </div>
                    <div style={{ display: 'flex', fontSize: 22.4, fontWeight: 500, color: 'rgba(241,235,219,0.85)', lineHeight: 1 }}>
                      {formatDate(ddd)}
                    </div>
                  </div>
                </>
              )}
            </div>
            {age !== null && (
              <div
                style={{
                  display: 'flex',
                  fontSize: 17.6,
                  fontWeight: 300,
                  letterSpacing: '3px',
                  textTransform: 'uppercase',
                  color: 'rgba(200,175,90,0.7)',
                }}
              >
                {age} ans
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    {
      width: CARD_W,
      height: CARD_H,
      fonts: [
        { name: 'Outfit', data: boldData, weight: 700, style: 'normal' },
        { name: 'Outfit', data: semiBoldData, weight: 600, style: 'normal' },
      ],
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    }
  );
}

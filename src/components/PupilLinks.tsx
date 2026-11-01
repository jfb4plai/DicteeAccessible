import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { Pupil } from '../lib/types';

function PupilLink({ accessCode, pupil }: { accessCode: string; pupil: Pupil }) {
  const url = `${window.location.origin}/eleve/jeu?session=${accessCode}&eleve=${pupil.code}`;
  const [qr, setQr] = useState('');
  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 140 }).then(setQr).catch(() => setQr('')); }, [url]);
  return (
    <div className="plai-card flex items-center gap-4">
      {qr && <img src={qr} alt={`QR code de ${pupil.code}`} width={96} height={96} />}
      <div style={{ minWidth: 0 }}>
        <strong>{pupil.code}</strong>
        <p className="help" style={{ wordBreak: 'break-all' }}>{url}</p>
      </div>
    </div>
  );
}

// Un lien et un QR code par élève : le lien contient le code de la dictée et le code de l'élève, jamais un prénom.
export default function PupilLinks({ accessCode, pupils }: { accessCode: string; pupils: Pupil[] }) {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {pupils.map(p => <PupilLink key={p.id} accessCode={accessCode} pupil={p} />)}
    </div>
  );
}

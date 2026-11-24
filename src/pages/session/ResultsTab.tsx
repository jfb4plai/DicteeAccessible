import { Link } from 'react-router-dom';
import { TabIntro, type TabProps } from './common';

export default function ResultsTab({ id, data, goTo }: TabProps) {
  return (
    <div>
      <TabIntro title="Les résultats">Ce que les élèves ont fait, mot par mot et phrase par phrase, avec ton commentaire et le suivi par élève.</TabIntro>
      {!data.session.published ? (
        <p className="plai-empty">La dictée n'est pas encore publiée : aucun résultat pour l'instant. <button type="button" className="plai-btn-ghost" onClick={() => goTo('publier')}>Aller à « Publier »</button></p>
      ) : data.attempts === 0 ? (
        <p className="plai-empty">Aucune réponse d'élève pour l'instant. Les résultats apparaissent dès que les élèves commencent.</p>
      ) : (
        <p className="plai-success">{data.attempts} réponse{data.attempts > 1 ? 's' : ''} d'élèves enregistrée{data.attempts > 1 ? 's' : ''}.</p>
      )}
      <p className="mt-3"><Link to={`/enseignant/resultats/${id}`} className="plai-btn no-underline inline-flex items-center">Ouvrir les résultats</Link></p>
    </div>
  );
}

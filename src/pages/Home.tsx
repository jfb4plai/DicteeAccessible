import { Link } from 'react-router-dom';
import { BookOpen, Users } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <img
            src="/plai-logo.jpg"
            alt="PlAI - Pôle Liégeois d'Accompagnement vers une École Inclusive"
            className="h-24 w-auto object-contain mx-auto mb-6"
          />
          <h1 className="text-5xl font-bold text-gray-800 mb-4">Dictée Interactive PLAI</h1>
          <p className="text-xl text-gray-600">Application d'apprentissage de l'orthographe</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <Link
            to="/enseignant/auth"
            className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all transform hover:-translate-y-1"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mb-6">
                <Users className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-3">Espace Enseignant</h2>
              <p className="text-gray-600">
                Créez des dictées, générez des codes de session et consultez les résultats de vos élèves
              </p>
            </div>
          </Link>

          <Link
            to="/eleve"
            className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all transform hover:-translate-y-1"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6">
                <BookOpen className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-3">Espace Élève</h2>
              <p className="text-gray-600">
                Rejoignez une session avec votre code et commencez la dictée interactive
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

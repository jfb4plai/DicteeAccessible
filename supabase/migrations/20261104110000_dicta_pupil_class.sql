/*
  # DictéeAccessible : classe d'un élève

  Une colonne texte libre `class_label` (« P3 », « P3 B ») pour regrouper les codes élèves.
  Jamais un prénom : l'application ne connaît que des codes anonymes.
  Les élèves existants restent sans classe (chaîne vide). Les droits de table existants couvrent la colonne.
  La suppression d'un élève supprime en cascade ses réponses, ses commentaires et ses liens de dictée
  (clés étrangères `on delete cascade` déjà posées dans 20261101120000).
*/

alter table dicta_pupils
  add column if not exists class_label text not null default '' check (char_length(class_label) <= 30);

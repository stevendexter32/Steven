# Améliorations du collage — éditeur de documents

Cette version ajoute des fonctions de collage dans `documents.html` :

## Word
- Choix entre l'insertion au point du curseur et le remplacement de tout le contenu de l'éditeur.
- Conservation des tableaux et de la mise en forme HTML déjà prise en charge par l'éditeur.
- Prise en charge des images collées lorsque le navigateur fournit une image `data:` ou un élément image dans le presse-papiers.
- Export des images intégrées en `ImageRun` dans le fichier DOCX.

## Excel
- Choix entre le collage à partir de la cellule active et le remplacement de la feuille.
- Lecture des tableaux HTML du presse-papiers (Word, Excel, pages web) et récupération de leurs valeurs.
- Le collage TSV existant reste disponible.

## PowerPoint
- Bouton permettant de coller le texte du presse-papiers dans une nouvelle diapositive.

## Limites à connaître
- Ce patch n'est pas un importeur natif complet des formats DOCX/XLSX/PPTX : il traite les données exposées par le presse-papiers du navigateur.
- Excel récupère les valeurs des tableaux HTML, mais ne reproduit pas encore les styles de cellules, formules complexes, graphiques, images ou objets incorporés dans le fichier XLSX.
- PowerPoint récupère le texte en titre et puces ; il ne reconstitue pas la disposition, les animations, les formes ni les images d'une diapositive copiée.
- Dans Word, les images distantes ou les images dont le navigateur ne fournit qu'une référence temporaire peuvent ne pas être intégrées. Les images au format pris en charge et transmises comme données intégrées sont exportées.
- L'accès au presse-papiers dépend des autorisations du navigateur et du contexte HTTPS. Sur Android, le collage direct par appui long reste le recours le plus fiable si le bouton de lecture du presse-papiers est refusé.
- La limite d'envoi de fichiers existante côté projet est conservée ; les documents très volumineux avec plusieurs images peuvent la dépasser.

Les fichiers API, le stockage Vercel Blob et les paramètres de déploiement n'ont pas été modifiés.

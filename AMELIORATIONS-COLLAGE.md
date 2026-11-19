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


## Correctif supplémentaire – import Word (19/11/2026)

- Le collage Word associe désormais les images fournies séparément par le presse-papiers aux balises image HTML dans leur ordre, au lieu de les déplacer systématiquement à la fin.
- Les images séparées sans balise HTML sont ajoutées en fin de contenu, car le presse-papiers ne fournit alors pas toujours leur position d'origine.
- Le nettoyage HTML conserve davantage de structure (titres, paragraphes, listes, liens, tableaux, cellules fusionnées) et un ensemble contrôlé de styles CSS inline.
- L'export DOCX récupère aussi certaines propriétés de texte (couleur hexadécimale, taille, police) et l'alignement du paragraphe.

## Limites connues à ne pas confondre avec une importation Office complète

- Le presse-papiers Android/navigateur peut ne pas exposer les images originales ou leur ordre. Les références d'images locales Office non fournies comme fichiers restent inaccessibles.
- L'export DOCX ne reproduit pas encore toutes les mises en page complexes, zones de texte, colonnes, positions flottantes, en-têtes/pieds de page, champs ou objets incorporés.
- Excel reste un éditeur de grille simple : le collage HTML récupère les valeurs, pas l'ensemble des styles, formules, graphiques, images ou fusions Excel.
- PowerPoint reste un générateur de diapositives textuelles : il ne reconstitue pas une diapositive copiée avec sa disposition, ses images et ses objets.
- Une vérification syntaxique JavaScript et l'intégrité de l'archive ont été effectuées. Aucun test réel dans Microsoft Office/Android ou navigateur distant n'est prétendu ici.

## Correctifs complémentaires – Excel et PowerPoint (19/11/2026)

- Excel : le collage d'un tableau HTML transfère maintenant les valeurs et plusieurs styles de cellules (couleur de texte/fond, gras, italique, souligné, taille de police, alignement, bordures simples). L'export utilise xlsx-js-style pour écrire les styles disponibles.
- PowerPoint : le bouton de collage tente maintenant de lire le HTML, le texte et les images PNG/JPEG exposés par l'API Clipboard du navigateur. Les images détectées sont ajoutées à la diapositive et à l'export, dans une disposition simple.

Ces améliorations ne reconstruisent pas la géométrie complète d'une diapositive PowerPoint ni les images dont le navigateur ne donne pas accès. Les tableaux Excel avec cellules fusionnées, formats numériques complexes, formules, graphiques et images ne sont pas importés intégralement. Les styles CSS complexes ou liés à des feuilles externes peuvent être perdus.

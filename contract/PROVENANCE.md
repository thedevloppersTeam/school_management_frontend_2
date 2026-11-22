# Contrat épinglé de l'API du serveur

`openapi.json` est une copie, octet pour octet, du contrat produit par le serveur
(ADR-007 § 2 : le frontend garde une copie épinglée du contrat, en génère ses
validateurs et valide chaque réponse avant usage). Ne pas la modifier à la main.

- Dépôt d'origine : `school_management_server`
- Chemin d'origine : `contract/openapi.json`
- Commit serveur : `591a861f7f03ced6b2a74736f2e20a4d67c01a6e`
- SHA-256 de la copie : `0d16ce23b519bcff989e90e0784174d91436e7ec21e3f34471685c540badc603`

## Mettre à jour

1. Copier le fichier du serveur au commit voulu, en conservant les octets.
   Depuis Git Bash : `git -C <serveur> show <commit>:contract/openapi.json > contract/openapi.json`.
   Depuis PowerShell, ne pas utiliser `>` (il réécrit fins de ligne et encodage) :
   `cmd /c "git -C <serveur> show <commit>:contract/openapi.json > contractopenapi.json"`.
2. Vérifier que la copie est identique au serveur, puis reporter ici le commit et le SHA-256 :
   `git -C <serveur> show <commit>:contract/openapi.json | sha256sum` et `sha256sum contract/openapi.json`
   doivent donner la même valeur. (`.gitattributes` interdit toute conversion des fins de ligne de la copie.)
3. Régénérer : `npm ci --prefix tools/contract` (une fois), puis `npm run contract:generate`.
4. Commiter ensemble la copie, ce fichier et `lib/api/menfp/contract.gen.ts`.

La CI régénère le fichier et échoue s'il diffère de la version commitée.

// La bibliothèque html-to-docx ne fournit pas de types.
//
// Déclaration minimale plutôt que `any` implicite : sans elle, TypeScript
// laisse passer n'importe quel appel, y compris une signature erronée qui
// n'échouerait qu'en production, au moment d'enregistrer le document d'un
// utilisateur.
declare module "html-to-docx" {
  interface DocxOptions {
    table?: { row?: { cantSplit?: boolean } };
    orientation?: "portrait" | "landscape";
    margins?: Record<string, number>;
    title?: string;
    creator?: string;
  }

  /**
   * Convertit de l'HTML en document Word.
   * Renvoie un Buffer sous Node, un Blob dans un navigateur.
   */
  export default function HTMLtoDOCX(
    htmlString: string,
    headerHTMLString?: string | null,
    documentOptions?: DocxOptions,
    footerHTMLString?: string | null,
  ): Promise<Buffer | Blob>;
}

// A font file imported as a data URI (Vite's `?inline`): the social images are made on the server.
declare module "*.woff2?inline" {
  const dataUri: string;
  export default dataUri;
}

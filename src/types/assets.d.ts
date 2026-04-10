declare module '*.pte' {
  const assetId: number;
  export default assetId;
}

declare module '*.pte.json' {
  const meta: {
    classes: string[];
    n_features: number;
    n_classes: number;
  };
  export default meta;
}

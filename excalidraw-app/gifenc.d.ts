declare module "gifenc" {
  export const GIFEncoder: (opts?: {
    auto?: boolean;
    initialCapacity?: number;
  }) => {
    writeFrame: (
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: number[][];
        first?: boolean;
        transparent?: boolean;
        transparentIndex?: number;
        delay?: number;
        repeat?: number;
        dispose?: number;
      },
    ) => void;
    finish: () => void;
    bytesView: () => Uint8Array;
  };

  export const quantize: (
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
  ) => number[][];

  export const applyPalette: (
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
  ) => Uint8Array;
}

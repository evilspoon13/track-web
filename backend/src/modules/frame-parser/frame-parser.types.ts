export interface FrameParserConfig {
  frames: Record<`0x${string}`, FrameDefinition>;
}

export interface FrameDefinition {
  can_id_label: string;
  signals: FrameSignal[];
}

export interface FrameSignal {
  name: string;
  start_byte: number;
  length: number;
  type: SignalType;
  scale: number;
  offset: number;
}

export enum SignalType {
    UINT8 = "uint8",
    INT8 = "int8",
    UINT16 = "uint16",
    INT16 = "int16",
    UINT32 = "uint32",
    INT32 = "int32",
    FLOAT = "float",
    DOUBLE = "double",
}

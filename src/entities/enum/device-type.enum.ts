export enum IoTDeviceType {
    GenericHttp = "GENERIC_HTTP",
    LoRaWAN = "LORAWAN",
    SigFox = "SIGFOX",
}

enum ApplicationDeviceTypeExtra {
    Other = "OTHER",
}

export type ApplicationDeviceTypeUnion = IoTDeviceType | ApplicationDeviceTypeExtra;
// Enums cannot be extended like types
export const ApplicationDeviceTypes = { ...IoTDeviceType, ...ApplicationDeviceTypeExtra };

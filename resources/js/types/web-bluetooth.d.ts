/**
 * Minimal Web Bluetooth typings.
 *
 * TypeScript's DOM lib does not ship these, and the API is only implemented by
 * Chromium browsers, so the surface used by the thermal printer service is
 * declared here rather than pulling in a dependency for it.
 */
declare global {
    type BluetoothServiceUUID = string | number;
    type BluetoothCharacteristicUUID = string | number;

    interface BluetoothRemoteGATTCharacteristic {
        readonly uuid: string;
        writeValue(value: BufferSource): Promise<void>;
        writeValueWithoutResponse?(value: BufferSource): Promise<void>;
    }

    interface BluetoothRemoteGATTService {
        readonly uuid: string;
        getCharacteristic(
            characteristic: BluetoothCharacteristicUUID,
        ): Promise<BluetoothRemoteGATTCharacteristic>;
        getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
    }

    interface BluetoothRemoteGATTServer {
        readonly connected: boolean;
        connect(): Promise<BluetoothRemoteGATTServer>;
        disconnect(): void;
        getPrimaryService(
            service: BluetoothServiceUUID,
        ): Promise<BluetoothRemoteGATTService>;
        getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
    }

    interface BluetoothDevice extends EventTarget {
        readonly id: string;
        readonly name?: string;
        readonly gatt?: BluetoothRemoteGATTServer;
    }

    interface RequestDeviceOptions {
        filters?: { services?: BluetoothServiceUUID[]; namePrefix?: string }[];
        optionalServices?: BluetoothServiceUUID[];
        acceptAllDevices?: boolean;
    }

    interface Bluetooth {
        getAvailability(): Promise<boolean>;
        requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
    }

    interface Navigator {
        readonly bluetooth?: Bluetooth;
    }
}

export {};

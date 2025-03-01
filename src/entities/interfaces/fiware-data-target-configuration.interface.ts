import { AuthorizationType } from "@enum/authorization-type.enum";

export interface FiwareDataTargetConfiguration {
    url: string;
    timeout: number;
    authorizationType: AuthorizationType;
    username?: string;
    password?: string;
    authorizationHeader?: string;
    tenant?: string;
    context?: string;
}

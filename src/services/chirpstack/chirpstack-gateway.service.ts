import { GenericChirpstackConfigurationService } from "./generic-chirpstack-configuration.service";
import {
    Injectable,
    BadRequestException,
    Logger,
    InternalServerErrorException,
    NotFoundException,
    HttpService,
} from "@nestjs/common";
import { AxiosResponse } from "axios";
import { ChirpstackReponseStatus } from "@dto/chirpstack/chirpstack-response.dto";
import { CreateGatewayDto } from "@dto/chirpstack/create-gateway.dto";
import { ListAllGatewaysReponseDto } from "@dto/chirpstack/list-all-gateways.dto";
import { UpdateGatewayDto } from "@dto/chirpstack/update-gateway.dto";
import { ErrorCodes } from "@enum/error-codes.enum";
import { ChirpstackErrorResponseDto } from "@dto/chirpstack/chirpstack-error-response.dto";
import { SingleGatewayResponseDto } from "@dto/chirpstack/single-gateway-response.dto";
import { ChirpstackSetupNetworkServerService } from "@services/chirpstack/network-server.service";

@Injectable()
export class ChirpstackGatewayService extends GenericChirpstackConfigurationService {
    constructor(
        private internalHttpService: HttpService,
        private chirpstackSetupNetworkServerService: ChirpstackSetupNetworkServerService
    ) {
        super(internalHttpService);
    }

    async createNewGateway(
        dto: CreateGatewayDto
    ): Promise<ChirpstackReponseStatus> {
        dto = await this.updateDto(dto);

        const result = await this.post("gateways", dto);
        return this.handlePossibleError(result, dto);
    }

    async listAllPaginated(
        limit?: number,
        offset?: number
    ): Promise<ListAllGatewaysReponseDto> {
        // Default parameters if not set
        if (!offset) {
            offset = 0;
        }
        if (!limit) {
            limit = 100;
        }
        return await this.getAllWithPagination("gateways", limit, offset);
    }

    async getOne(gatewayId: string): Promise<SingleGatewayResponseDto> {
        try {
            const result: SingleGatewayResponseDto = await this.get(
                `gateways/${gatewayId}`
            );

            return result;
        } catch (err) {
            Logger.error(
                `Tried to find gateway with id: '${gatewayId}', got an error: ${JSON.stringify(
                    err
                )}`
            );
            if (err?.message == "object does not exist") {
                throw new NotFoundException(ErrorCodes.IdDoesNotExists);
            }
            throw new InternalServerErrorException(err?.response?.data);
        }
    }

    async modifyGateway(
        gatewayId: string,
        dto: UpdateGatewayDto
    ): Promise<ChirpstackReponseStatus> {
        dto = await this.updateDto(dto);
        const result = await this.put("gateways", dto, gatewayId);
        return this.handlePossibleError(result, dto);
    }

    async deleteGateway(gatewayId: string): Promise<ChirpstackReponseStatus> {
        try {
            await this.delete("gateways", gatewayId);
            return {
                success: true,
            };
        } catch (err) {
            Logger.error(
                `Got error from Chirpstack: ${JSON.stringify(
                    err?.response?.data
                )}`
            );
            return {
                success: false,
                chirpstackError: err?.response
                    ?.data as ChirpstackErrorResponseDto,
            };
        }
    }

    private handlePossibleError(
        result: AxiosResponse,
        dto: CreateGatewayDto | UpdateGatewayDto
    ): ChirpstackReponseStatus {
        if (result.status != 200) {
            Logger.error(
                `Error from Chirpstack: '${JSON.stringify(
                    dto
                )}', got response: ${JSON.stringify(result.data)}`
            );
            throw new BadRequestException({
                success: false,
                error: result.data,
            });
        }

        return { success: true };
    }

    private async updateDto(
        dto: CreateGatewayDto | UpdateGatewayDto
    ): Promise<CreateGatewayDto | UpdateGatewayDto> {
        // Chirpstack requires 'gatewayProfileID' to be set (with value or null)
        if (!dto?.gateway?.gatewayProfileID) {
            dto.gateway.gatewayProfileID = null;
        }

        // Add network server
        if (!dto?.gateway?.networkServerID) {
            dto.gateway.networkServerID = await this.getNetworkServerId();
        }

        if (!dto?.gateway?.organizationID) {
            dto.gateway.organizationID = await this.getDefaultOrganizationId();
        }

        if (!dto?.gateway?.tagsString) {
            dto.gateway.tags = JSON.parse(dto.gateway.tagsString)
        }

        return dto;
    }

    private async getOrganizationId(): Promise<string> {
        let id: string;
        await this.chirpstackSetupNetworkServerService
            .getNetworkServers(1000, 0)
            .then(response => {
                response.result.forEach(element => {
                    if (element.name === "OS2iot") {
                        id = element.id.toString();
                    }
                });
            });
        return id;
    }

    private async getNetworkServerId(): Promise<string> {
        let id: string;
        await this.chirpstackSetupNetworkServerService
            .getNetworkServers(1000, 0)
            .then(response => {
                response.result.forEach(element => {
                    if (element.name === "OS2iot") {
                        id = element.id.toString();
                    }
                });
            });
        return id;
    }

    private async getDefaultOrganizationId(): Promise<string> {
        await this.chirpstackSetupNetworkServerService
            .getOrganizations(1000, 0)
            .then(response => {
                response.result.forEach(element => {
                    if (
                        element.name == "OS2iot" ||
                        element.name == "chirpstack"
                    ) {
                        return element.id;
                    }
                });
            });
        return "1";
    }
}

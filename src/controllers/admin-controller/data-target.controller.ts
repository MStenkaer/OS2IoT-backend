import {
    Body,
    Controller,
    Delete,
    Get,
    Header,
    NotFoundException,
    Param,
    ParseIntPipe,
    Post,
    Put,
    Query,
    Req,
    UseGuards,
} from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiForbiddenResponse,
    ApiOperation,
    ApiTags,
    ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { ComposeAuthGuard } from '@auth/compose-auth.guard';
import { Read, ApplicationAdmin } from "@auth/roles.decorator";
import { RolesGuard } from "@auth/roles.guard";
import { CreateDataTargetDto } from "@dto/create-data-target.dto";
import { DeleteResponseDto } from "@dto/delete-application-response.dto";
import { AuthenticatedRequest } from "@dto/internal/authenticated-request";
import { ListAllDataTargetsResponseDto } from "@dto/list-all-data-targets-response.dto";
import { ListAllDataTargetsDto } from "@dto/list-all-data-targets.dto";
import { UpdateDataTargetDto } from "@dto/update-data-target.dto";
import { DataTarget } from "@entities/data-target.entity";
import { ErrorCodes } from "@enum/error-codes.enum";
import {
    checkIfUserHasAccessToApplication,
    ApplicationAccessScope,
} from "@helpers/security-helper";
import { DataTargetService } from "@services/data-targets/data-target.service";
import { AuditLog } from "@services/audit-log.service";
import { ActionType } from "@entities/audit-log-entry";

@ApiTags("Data Target")
@Controller("data-target")
@UseGuards(ComposeAuthGuard, RolesGuard)
@ApiBearerAuth()
@Read()
@ApiForbiddenResponse()
@ApiUnauthorizedResponse()
export class DataTargetController {
    constructor(private dataTargetService: DataTargetService) {}

    @Get()
    @ApiOperation({ summary: "Find all DataTargets" })
    async findAll(
        @Req() req: AuthenticatedRequest,
        @Query() query?: ListAllDataTargetsDto
    ): Promise<ListAllDataTargetsResponseDto> {
        if (req.user.permissions.isGlobalAdmin) {
            return await this.dataTargetService.findAndCountAllWithPagination(query);
        } else {
            if (query.applicationId) {
                query.applicationId = +query.applicationId;
            }

            checkIfUserHasAccessToApplication(req, query.applicationId, ApplicationAccessScope.Read);
            const allowed = req.user.permissions.getAllApplicationsWithAtLeastRead();

            return await this.dataTargetService.findAndCountAllWithPagination(
                query,
                allowed
            );
        }
    }

    @Get(":id")
    @ApiOperation({ summary: "Find DataTarget by id" })
    async findOne(
        @Req() req: AuthenticatedRequest,
        @Param("id", new ParseIntPipe()) id: number
    ): Promise<DataTarget> {
        try {
            const dataTarget = await this.dataTargetService.findOne(id);
            checkIfUserHasAccessToApplication(req, dataTarget.application.id, ApplicationAccessScope.Read);
            return dataTarget;
        } catch (err) {
            throw new NotFoundException(ErrorCodes.IdDoesNotExists);
        }
    }

    @Post()
    @ApiOperation({ summary: "Create a new DataTargets" })
    @ApiBadRequestResponse()
    async create(
        @Req() req: AuthenticatedRequest,
        @Body() createDataTargetDto: CreateDataTargetDto
    ): Promise<DataTarget> {
        try {
            checkIfUserHasAccessToApplication(
                req,
                createDataTargetDto.applicationId,
                ApplicationAccessScope.Write
            );
            const dataTarget = await this.dataTargetService.create(
                createDataTargetDto,
                req.user.userId
            );
            AuditLog.success(
                ActionType.CREATE,
                DataTarget.name,
                req.user.userId,
                dataTarget.id,
                dataTarget.name
            );
            return dataTarget;
        } catch (err) {
            AuditLog.fail(ActionType.CREATE, DataTarget.name, req.user.userId);
            throw err;
        }
    }

    @Put(":id")
    @Header("Cache-Control", "none")
    @ApiOperation({ summary: "Update an existing DataTarget" })
    @ApiBadRequestResponse()
    async update(
        @Req() req: AuthenticatedRequest,
        @Param("id", new ParseIntPipe()) id: number,
        @Body() updateDto: UpdateDataTargetDto
    ): Promise<DataTarget> {
        const oldDataTarget = await this.dataTargetService.findOne(id);
        try {
            checkIfUserHasAccessToApplication(req, oldDataTarget.application.id, ApplicationAccessScope.Write);
            if (oldDataTarget.application.id !== updateDto.applicationId) {
                checkIfUserHasAccessToApplication(req, updateDto.applicationId, ApplicationAccessScope.Write);
            }
        } catch (err) {
            AuditLog.fail(
                ActionType.UPDATE,
                DataTarget.name,
                req.user.userId,
                oldDataTarget.id,
                oldDataTarget.name
            );
            throw err;
        }

        const dataTarget = await this.dataTargetService.update(
            id,
            updateDto,
            req.user.userId
        );
        AuditLog.success(
            ActionType.UPDATE,
            DataTarget.name,
            req.user.userId,
            dataTarget.id,
            dataTarget.name
        );
        return dataTarget;
    }

    @Delete(":id")
    @ApiOperation({ summary: "Delete an existing DataTarget" })
    @ApiBadRequestResponse()
    @ApplicationAdmin()
    async delete(
        @Req() req: AuthenticatedRequest,
        @Param("id", new ParseIntPipe()) id: number
    ): Promise<DeleteResponseDto> {
        try {
            const dt = await this.dataTargetService.findOne(id);
            checkIfUserHasAccessToApplication(req, dt.application.id, ApplicationAccessScope.Write);
            const result = await this.dataTargetService.delete(id);

            if (result.affected === 0) {
                throw new NotFoundException(ErrorCodes.IdDoesNotExists);
            }
            AuditLog.success(ActionType.DELETE, DataTarget.name, req.user.userId, id);
            return new DeleteResponseDto(result.affected);
        } catch (err) {
            AuditLog.fail(ActionType.DELETE, DataTarget.name, req.user.userId, id);
            if (err?.status === 403) {
                throw err;
            }
            throw new NotFoundException(err);
        }
    }
}

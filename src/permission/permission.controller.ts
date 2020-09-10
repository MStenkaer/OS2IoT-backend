import {
    Controller,
    Logger,
    Post,
    Body,
    Put,
    Param,
    UseGuards,
    Get,
    Req,
    ForbiddenException,
    Delete,
} from "@nestjs/common";
import { PermissionService } from "./permission.service";
import {
    ApiOperation,
    ApiTags,
    ApiBearerAuth,
    ApiForbiddenResponse,
    ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Permission } from "@entities/permission.entity";
import { CreatePermissionDto } from "./create-permission.dto";
import { UpdatePermissionDto } from "./update-permission.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../user/roles.guard";
import { OrganizationAdmin } from "../user/roles.decorator";
import { RequestHasAtLeastAUser } from "../auth/has-at-least-user";
import { checkIfUserHasAdminAccessToOrganization } from "../auth/security-helper";
import { PermissionType } from "@enum/permission-type.enum";
import { OrganizationPermission } from "../entities/organizion-permission.entity";
import { DeleteResponseDto } from "../entities/dto/delete-application-response.dto";

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@OrganizationAdmin()
@ApiForbiddenResponse()
@ApiUnauthorizedResponse()
@ApiTags("User Management")
@Controller("permission")
export class PermissionController {
    constructor(private permissionService: PermissionService) {}
    private readonly logger = new Logger(PermissionController.name);

    @OrganizationAdmin()
    @Post()
    @ApiOperation({ summary: "Create new permission entity" })
    async createPermission(
        @Req() req: RequestHasAtLeastAUser,
        @Body() dto: CreatePermissionDto
    ): Promise<Permission> {
        checkIfUserHasAdminAccessToOrganization(req, dto.organizationId);

        return await this.permissionService.createNewPermission(dto);
    }

    @OrganizationAdmin()
    @Put(":id")
    @ApiOperation({ summary: "Update permission" })
    async updatePermission(
        @Req() req: RequestHasAtLeastAUser,
        @Param("id") id: number,
        @Body() dto: UpdatePermissionDto
    ): Promise<Permission> {
        const permission = await this.permissionService.getPermission(id);
        checkIfUserHasAdminAccessToOrganization(req, permission.id);

        return await this.permissionService.updatePermission(id, dto);
    }

    @OrganizationAdmin()
    @Delete(":id")
    @ApiOperation({ summary: "Delete a permission entity" })
    async deletePermission(
        @Req() req: RequestHasAtLeastAUser,
        @Param("id") id: number
    ): Promise<DeleteResponseDto> {
        const permission = await this.permissionService.getPermission(id);
        checkIfUserHasAdminAccessToOrganization(req, permission.id);

        return await this.permissionService.deletePermission(id);
    }

    @OrganizationAdmin()
    @Get()
    @ApiOperation({ summary: "Get list of all permissions" })
    async getAllPermissions(
        @Req() req: RequestHasAtLeastAUser
    ): Promise<Permission[]> {
        if (req.user.permissions.isGlobalAdmin) {
            return this.permissionService.getAllPermissions();
        } else {
            const allowedOrganizations = req.user.permissions.getAllOrganizationsWithAtLeastAdmin();
            return this.permissionService.getAllPermissionsInOrganizations(
                allowedOrganizations
            );
        }
    }

    @OrganizationAdmin()
    @Get(":id")
    @ApiOperation({ summary: "Get permissions entity" })
    async getOnePermissions(
        @Req() req: RequestHasAtLeastAUser,
        @Param("id") id: number
    ): Promise<Permission> {
        const permission = await this.permissionService.getPermission(id);

        if (req.user.permissions.isGlobalAdmin) {
            return permission;
        } else {
            if (permission.type == PermissionType.GlobalAdmin) {
                throw new ForbiddenException();
            }

            const organizationPermission = permission as OrganizationPermission;
            checkIfUserHasAdminAccessToOrganization(
                req,
                organizationPermission.organization.id
            );

            return organizationPermission;
        }
    }
}

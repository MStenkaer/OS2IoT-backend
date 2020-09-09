import {
    Controller,
    Get,
    Post,
    Header,
    Body,
    Query,
    Put,
    Param,
    NotFoundException,
    Delete,
    Logger,
    UseGuards,
    Req,
} from "@nestjs/common";
import {
    ApiProduces,
    ApiTags,
    ApiOperation,
    ApiBadRequestResponse,
    ApiNotFoundResponse,
    ApiBearerAuth,
} from "@nestjs/swagger";
import { Application } from "@entities/application.entity";
import { ApplicationService } from "@services/application.service";
import { CreateApplicationDto } from "@dto/create-application.dto";
import { ListAllEntitiesDto } from "@dto/list-all-entities.dto";
import { ListAllApplicationsReponseDto } from "@dto/list-all-applications-response.dto";
import { ApiResponse } from "@nestjs/swagger";
import { UpdateApplicationDto } from "@dto/update-application.dto";
import { DeleteResponseDto } from "@dto/delete-application-response.dto";
import { ErrorCodes } from "@enum/error-codes.enum";
import { BadRequestException } from "@nestjs/common";
import { RolesGuard } from "../user/roles.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Read, Write } from "../user/roles.decorator";
import { User } from "../entities/user.entity";
import { AuthenticatedUser } from "../auth/authenticated-user";

type hasAtLeastAUser = {
    user: AuthenticatedUser;
};

@ApiTags("Application")
@Controller("application")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Read()
export class ApplicationController {
    constructor(private applicationService: ApplicationService) {}

    @Read()
    @Get()
    @ApiProduces("application/json")
    @ApiOperation({ summary: "Find all Applications (paginated)" })
    @ApiResponse({
        status: 200,
        description: "Success",
        type: ListAllApplicationsReponseDto,
    })
    async findAll(
        @Req() req: hasAtLeastAUser,
        @Query() query?: ListAllEntitiesDto
    ): Promise<ListAllApplicationsReponseDto> {
        const allowedOrganizations = req.user.permissions.getAllApplicationsWithRead();

        const applications = await this.applicationService.findAndCountWithPagination(
            query
        );
        return applications;
    }

    @Get(":id")
    @ApiOperation({ summary: "Find one Application by id" })
    @ApiNotFoundResponse()
    async findOne(@Param("id") id: number): Promise<Application> {
        try {
            return await this.applicationService.findOne(id);
        } catch (err) {
            throw new NotFoundException(ErrorCodes.IdDoesNotExists);
        }
    }

    @Write()
    @Post()
    @Header("Cache-Control", "none")
    @ApiOperation({ summary: "Create a new Application" })
    @ApiBadRequestResponse()
    async create(
        @Body() createApplicationDto: CreateApplicationDto
    ): Promise<Application> {
        const isValid = await this.applicationService.isNameValidAndNotUsed(
            createApplicationDto?.name
        );

        if (!isValid) {
            Logger.error(
                `Tried to create an application with name: '${createApplicationDto.name}'`
            );
            throw new BadRequestException(ErrorCodes.NameInvalidOrAlreadyInUse);
        }

        const application = this.applicationService.create(
            createApplicationDto
        );
        return application;
    }

    @Write()
    @Put(":id")
    @Header("Cache-Control", "none")
    @ApiOperation({ summary: "Update an existing Application" })
    @ApiBadRequestResponse()
    async update(
        @Param("id") id: number,
        @Body() updateApplicationDto: UpdateApplicationDto
    ): Promise<Application> {
        const isValid = await this.applicationService.isNameValidAndNotUsed(
            updateApplicationDto?.name,
            id
        );

        if (!isValid) {
            Logger.error(
                `Tried to change an application with name: '${updateApplicationDto.name}'`
            );
            throw new BadRequestException(ErrorCodes.NameInvalidOrAlreadyInUse);
        }

        const application = await this.applicationService.update(
            id,
            updateApplicationDto
        );

        return application;
    }

    @Write()
    @Delete(":id")
    @ApiOperation({ summary: "Delete an existing Application" })
    @ApiBadRequestResponse()
    async delete(@Param("id") id: number): Promise<DeleteResponseDto> {
        try {
            const result = await this.applicationService.delete(id);

            if (result.affected === 0) {
                throw new NotFoundException(ErrorCodes.IdDoesNotExists);
            }
            return new DeleteResponseDto(result.affected);
        } catch (err) {
            throw new NotFoundException(err);
        }
    }
}

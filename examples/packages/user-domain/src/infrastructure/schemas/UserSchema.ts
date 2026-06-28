import { Entity } from "dynamodb-onetable";
import { USER_ROLES, USER_STATUSES } from '../../domain/constants';


export const UserSchema = {
    version: '0.0.1',
    indexes: {
        primary: { hash: 'PK', sort: 'SK' },
        GSI1: { hash: 'GSI1PK', sort: 'GSI1SK' },
        GSI3: { hash: 'GSI3PK', sort: 'GSI3SK' },
        GSI4: { hash: 'GSI4PK' },
        GSI5: { hash: 'GSI5PK', sort: 'GSI5SK' },
        GSI6: { hash: 'GSI6PK', sort: 'GSI6SK' },
      
    },
    models: {
        User: {
            PK: { type: String, value: 'USER', hidden: false },
            SK: { type: String, value: '${userId}', hidden: false },
            userRole: {
                type: String,
                enum: USER_ROLES,
                required: true,
            },
            userStatus: {
                type: String,
                enum: USER_STATUSES,
                required: true,
            },
            userId: { type: String, generate: 'ulid' },
            email: { type: String, required: true },
            GSI1PK: { type: String, value: 'USER#${userRole}#${userStatus}', hidden: false },
            GSI1SK: { type: String, value: '${email}', hidden: false },
            GSI3PK: { type: String, value: 'USER#${userStatus}', hidden: false },
            GSI3SK: { type: String, value: '${userRole}', hidden: false },
            GSI4PK: { type: String, value: 'USER#${email}', hidden: false },
            GSI5PK: { type: String, value: 'USER#${userStatus}', hidden: false },
            GSI5SK: { type: String, value: '${email}', hidden: false },
            GSI6PK: { type: String, value: 'USER#', hidden: false },
            GSI6SK: { type: String, value: '${dateCreated}', hidden: false },
            dateCreated: { type: String },
            firstName: { type: String, required: true },
            lastName: { type: String, required: true },
            emailVerified: { type: Boolean, default: false },
            data: {
                type: Object,
                default: {},
                schema: {
                    country: { type: String },
                },
            },
        },
    } as const,
    params: {
        isoDates: true,
        timestamps: true,
    },
};

export type UserDataType = Entity<typeof UserSchema.models.User>;

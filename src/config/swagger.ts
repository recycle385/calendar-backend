import swaggerJSDoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MOIM',
      version: '1.0.0',
    },

    components: {
      securitySchemes: {
        UserAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        ParticipantAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['src/routes/*.ts', 'src/models/swagger.dtos/*.ts'],
};

export const swaggerSets = swaggerJSDoc(options);

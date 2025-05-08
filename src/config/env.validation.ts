import * as Joi from 'joi';

export const validate = (config: Record<string, unknown>) => {
  const schema = Joi.object({
    NODE_ENV: Joi.string()
      .valid('development', 'production', 'test')
      .default('development'),
    PORT: Joi.number().default(3000),
    
    // Database
    DATABASE_URL: Joi.string().required(),
    
    // JWT
    JWT_SECRET: Joi.string().required(),
    JWT_EXPIRATION: Joi.string().default('1d'),
    
    // Email
    SMTP_URL: Joi.string().required(),

    
    // Application
    APP_URL: Joi.string().required(),
    
    // Rate limiting
    THROTTLE_TTL: Joi.number().default(60),
    THROTTLE_LIMIT: Joi.number().default(10),
  });
  
  const { error, value } = schema.validate(config, { allowUnknown: true });
  
  if (error) {
    throw new Error(`Config validation error: ${error.message}`);
  }
  
  return value;
};
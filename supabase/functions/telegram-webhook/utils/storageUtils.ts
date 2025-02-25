import { getLogger } from "./logger.ts";

export async function ensureStorageBucketExists(
  supabase: any,
  bucketName: string, 
  correlationId: string
): Promise<void> {
  const logger = getLogger(correlationId);
  logger.info('Checking if storage bucket exists', { bucketName });
  
  try {
    // List buckets to check if our bucket exists
    const { data: buckets, error: listError } = await supabase
      .storage
      .listBuckets();
      
    if (listError) {
      logger.error('Error listing buckets', { error: listError.message });
      throw listError;
    }
    
    // Check if our bucket exists
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      logger.info('Bucket doesn\'t exist, creating', { bucketName });
      
      // Create the bucket with public access
      const { error: createError } = await supabase
        .storage
        .createBucket(bucketName, {
          public: true, // Make files publicly accessible
          fileSizeLimit: 50 * 1024 * 1024, // 50MB limit
        });
        
      if (createError) {
        logger.error('Error creating bucket', { error: createError.message });
        throw createError;
      }
      
      logger.info('Successfully created bucket', { bucketName });
    } else {
      logger.info('Bucket already exists', { bucketName });
    }
  } catch (error) {
    logger.error('Error ensuring bucket exists', { error: error.message });
    throw error;
  }
}

export async function checkFileExistsInStorage(
  supabase: any,
  bucketName: string,
  storagePath: string, 
  correlationId: string
): Promise<boolean> {
  const logger = getLogger(correlationId);
  logger.info('Checking if file exists in storage', { bucketName, storagePath });
  
  try {
    // Ensure the bucket exists first
    await ensureStorageBucketExists(supabase, bucketName, correlationId);
    
    const { data: fileExists, error } = await supabase
      .storage
      .from(bucketName)
      .list('', {
        limit: 1,
        search: storagePath
      });
    
    if (error) {
      logger.error('Error checking storage', { error: error.message });
      return false;
    }
    
    const fileExistsInStorage = fileExists && fileExists.length > 0;
    logger.info('Storage check result', {
      bucket: bucketName,
      path: storagePath,
      exists: fileExistsInStorage
    });
    
    return fileExistsInStorage;
  } catch (error) {
    logger.error('Error checking storage', { error: error.message });
    return false;
  }
}

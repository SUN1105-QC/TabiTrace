package com.tabitrace.photo.storage;

import org.junit.jupiter.api.Test;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class R2StorageServiceTest {
    @Test void existsReflectsHeadObjectResult(){
        S3Client client=mock(S3Client.class);
        R2StorageService s=new R2StorageService("bucket","https://cdn.example.com/",mock(S3Presigner.class),client);
        when(client.headObject(any(HeadObjectRequest.class))).thenReturn(HeadObjectResponse.builder().build());
        assertTrue(s.exists("users/1/trips/2/a.jpg"));
        when(client.headObject(any(HeadObjectRequest.class))).thenThrow(NoSuchKeyException.builder().statusCode(404).build());
        assertFalse(s.exists("users/1/trips/2/missing.jpg"));
    }

    @Test void existsDoesNotHideStorageErrors(){
        S3Client client=mock(S3Client.class);
        R2StorageService s=new R2StorageService("bucket","https://cdn.example.com",mock(S3Presigner.class),client);
        when(client.headObject(any(HeadObjectRequest.class))).thenThrow(S3Exception.builder().statusCode(403).build());
        assertThrows(S3Exception.class,()->s.exists("users/1/trips/2/a.jpg"));
    }
}

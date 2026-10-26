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

    @Test void deleteRemovesObjectsAndFailuresAreNotHidden(){
        S3Client client=mock(S3Client.class);
        R2StorageService s=new R2StorageService("bucket","https://cdn.example.com",mock(S3Presigner.class),client);
        s.delete("users/1/trips/2/a.jpg");
        verify(client).deleteObject(any(software.amazon.awssdk.services.s3.model.DeleteObjectRequest.class));
        when(client.deleteObjects(any(software.amazon.awssdk.services.s3.model.DeleteObjectsRequest.class)))
                .thenReturn(software.amazon.awssdk.services.s3.model.DeleteObjectsResponse.builder().build());
        s.deleteAll(java.util.List.of("users/1/trips/2/a.jpg","users/1/trips/2/b.jpg"));
        verify(client).deleteObjects(any(software.amazon.awssdk.services.s3.model.DeleteObjectsRequest.class));
        when(client.deleteObject(any(software.amazon.awssdk.services.s3.model.DeleteObjectRequest.class))).thenThrow(S3Exception.builder().statusCode(500).build());
        assertThrows(com.tabitrace.common.BusinessException.class,()->s.delete("users/1/trips/2/c.jpg"));
    }

    @Test void keyOfOnlyAcceptsOwnPublicUrls(){
        R2StorageService s=new R2StorageService("bucket","https://cdn.example.com/",mock(S3Presigner.class),mock(S3Client.class));
        assertEquals("users/1/avatar/a.jpg",s.keyOf("https://cdn.example.com/users/1/avatar/a.jpg"));
        assertNull(s.keyOf("https://evil.example.com/users/1/avatar/a.jpg"));
        assertNull(s.keyOf(null));
    }
}

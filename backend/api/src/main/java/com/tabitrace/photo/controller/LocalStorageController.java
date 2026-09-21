package com.tabitrace.photo.controller;

import com.tabitrace.photo.storage.LocalStorageService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/local-storage")
@ConditionalOnProperty(name="app.storage.mode",havingValue="local")
public class LocalStorageController {
    private final LocalStorageService storage;
    public LocalStorageController(LocalStorageService storage){this.storage=storage;}
    @PutMapping("/upload") public ResponseEntity<Void> upload(@RequestParam String key,@RequestParam(required=false) Long expires,@RequestParam(required=false) String signature,@RequestBody byte[] body){if(!storage.verifyUpload(key,expires,signature)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();if(body.length>20*1024*1024) return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).build();storage.write(key,body);return ResponseEntity.noContent().build();}
    @GetMapping("/file") public ResponseEntity<byte[]> file(@RequestParam String key){byte[] data=storage.read(key);MediaType type=key.endsWith(".png")?MediaType.IMAGE_PNG:key.endsWith(".gif")?MediaType.IMAGE_GIF:MediaType.parseMediaType(key.endsWith(".webp")?"image/webp":"image/jpeg");return ResponseEntity.ok().contentType(type).cacheControl(CacheControl.noCache()).body(data);}
}

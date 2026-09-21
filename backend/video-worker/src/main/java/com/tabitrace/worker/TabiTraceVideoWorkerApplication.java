package com.tabitrace.worker;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class TabiTraceVideoWorkerApplication {
    public static void main(String[] args){SpringApplication.run(TabiTraceVideoWorkerApplication.class,args);}
}

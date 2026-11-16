package com.tabitrace.admin;

import com.tabitrace.auth.mapper.RefreshTokenMapper;
import com.tabitrace.config.SecurityConfig;
import com.tabitrace.security.JwtAuthenticationFilter;
import com.tabitrace.security.JwtService;
import com.tabitrace.user.entity.UserEntity;
import com.tabitrace.user.mapper.UserMapper;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.*;
import org.springframework.context.annotation.*;
import org.springframework.mock.web.*;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import com.tabitrace.trip.controller.TripExportController;
import com.tabitrace.trip.service.TripExportService;
import com.tabitrace.trip.service.TripService;
import java.io.OutputStream;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AdminHttpAuthorizationTest {
    AnnotationConfigWebApplicationContext context;
    static final JwtService jwt=mock(JwtService.class);
    static final UserMapper users=mock(UserMapper.class);
    static final RefreshTokenMapper sessions=mock(RefreshTokenMapper.class);
    @Configuration @EnableWebSecurity @Import(SecurityConfig.class)
    static class Config{
        @Bean JwtAuthenticationFilter jwtAuthenticationFilter(){return new JwtAuthenticationFilter(jwt,sessions,users);}
    }
    @BeforeEach void start(){
        reset(jwt,users,sessions);SecurityContextHolder.clearContext();
        context=new AnnotationConfigWebApplicationContext();context.setServletContext(new MockServletContext());context.register(Config.class);context.refresh();
        when(jwt.parse("token")).thenReturn(Jwts.claims().subject("1").add("type","ACCESS").add("sess","live").build());
        when(sessions.isSessionActive("live",1L)).thenReturn(true);
    }
    @AfterEach void close(){context.close();SecurityContextHolder.clearContext();}
    int call(String role,String status,String path)throws Exception{
        return call(role,status,path,"GET");
    }
    int call(String role,String status,String path,String method)throws Exception{
        var u=new UserEntity();u.id=1L;u.role=role;u.status=status;when(users.findById(1L)).thenReturn(u);
        var request=new MockHttpServletRequest(method,path);request.setServletPath(path);request.addHeader("Authorization","Bearer token");
        var response=new MockHttpServletResponse();
        context.getBean(FilterChainProxy.class).doFilter(request,response,new MockFilterChain());
        return response.getStatus();
    }
    @Test void ordinaryUserCannotReadAdminData()throws Exception{assertEquals(403,call("USER","ACTIVE","/api/v1/admin/overview"));}
    @Test void ordinaryUserCannotReadDetailsOrWritePermissions()throws Exception{
        assertEquals(403,call("USER","ACTIVE","/api/v1/admin/users/2"));SecurityContextHolder.clearContext();
        assertEquals(403,call("USER","ACTIVE","/api/v1/admin/users/2","PUT"));SecurityContextHolder.clearContext();
        assertEquals(403,call("USER","ACTIVE","/api/v1/admin/messages/page"));
    }
    @Test void administratorCanReadDashboardButCannotCreatePersonalJourneys()throws Exception{
        assertEquals(200,call("ADMIN","ACTIVE","/api/v1/admin/overview"));SecurityContextHolder.clearContext();
        assertEquals(403,call("ADMIN","ACTIVE","/api/v1/trips"));
    }
    @Test void disabledUserIsRejectedEvenWithAnExistingAccessToken()throws Exception{assertEquals(401,call("USER","DISABLED","/api/v1/trips"));}
    @Test void revokedSessionCannotReadAdminData()throws Exception{when(sessions.isSessionActive("live",1L)).thenReturn(false);assertEquals(401,call("ADMIN","ACTIVE","/api/v1/admin/users"));}
    @Test void administratorCanReadOwnIdentityForLoginRouting()throws Exception{assertEquals(200,call("ADMIN","ACTIVE","/api/v1/users/me"));}
    @Test void allNewManagementModulesRejectOrdinaryUsers()throws Exception{
        for(String path:java.util.List.of("/invitations","/trips","/media","/settings/defaults","/settings/runtime","/audit-logs","/maintenance","/maintenance/jobs")){
            SecurityContextHolder.clearContext();assertEquals(403,call("USER","ACTIVE","/api/v1/admin"+path),path);
        }
        for(String path:java.util.List.of("/invitations","/invitations/2/RESEND","/invitations/2/REVOKE","/users/2/deletion","/users/2/cancel-deletion","/trips/2/action","/media/PHOTO/2/deletion","/maintenance/jobs")){
            SecurityContextHolder.clearContext();assertEquals(403,call("USER","ACTIVE","/api/v1/admin"+path,"POST"),path);
        }
        SecurityContextHolder.clearContext();assertEquals(403,call("USER","ACTIVE","/api/v1/admin/settings/defaults","PUT"));
    }
    @Test void zipDownloadRetainsUserAuthenticationAcrossAsyncDispatch()throws Exception{
        var user=new UserEntity();user.id=1L;user.role="USER";user.status="ACTIVE";when(users.findById(1L)).thenReturn(user);
        var tripService=mock(TripService.class);var export=mock(TripExportService.class);
        doAnswer(i->{((OutputStream)i.getArgument(2)).write(new byte[]{80,75});return null;}).when(export).write(eq(1L),eq(10L),any());
        var mvc=MockMvcBuilders.standaloneSetup(new TripExportController(tripService,export))
                .addFilters(context.getBean(FilterChainProxy.class)).build();
        var result=mvc.perform(get("/api/v1/trips/10/export").header("Authorization","Bearer token")).andReturn();
        assertTrue(result.getRequest().isAsyncStarted());result.getAsyncResult(5000);
        var response=mvc.perform(asyncDispatch(result)).andReturn().getResponse();
        assertEquals(200,response.getStatus());assertArrayEquals(new byte[]{80,75},response.getContentAsByteArray());
    }
}

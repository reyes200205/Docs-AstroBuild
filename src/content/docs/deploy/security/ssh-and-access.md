---
title: SSH y accesos
description: Quién está conectado, quién entró, intentos fallidos, llaves autorizadas, usuarios con privilegios y uso de sudo.
---

SSH solo acepta **llaves**, nunca contraseñas, y solo a `ubuntu` y `deploy`. Con `LogLevel VERBOSE`
cada acceso queda registrado con la **huella de la llave** que se usó. La configuración está en
[Servidor](/deploy/infrastructure/server/#ssh).

## Quién está conectado

```bash
w
```

Muestra cada sesión abierta, desde qué IP y qué está ejecutando.

## Quién entró

Últimos accesos correctos, con IP:

```bash
last -n 20 -a
```

Accesos aceptados en las últimas 24 horas, con la llave usada:

```bash
sudo journalctl -u ssh --since "24 hours ago" | grep "Accepted publickey"
```

Cada línea termina en `ED25519 SHA256:...`: esa es la huella de la llave. Compárala con la lista
de [llaves autorizadas](#llaves-autorizadas). Una huella que no reconoces es un incidente.

Reinicios del servidor:

```bash
last reboot -n 10
```

## Intentos fallidos

Son normales: cualquier IP pública recibe escaneos a todas horas. Sirven para ver volumen y
patrones, no para alarmarse.

```bash
sudo journalctl -u ssh --since "24 hours ago" | grep -E "Failed|Invalid user" | tail -n 30
```

Las IPs que más lo intentan:

```bash
sudo journalctl -u ssh --since "7 days ago" | grep -oE "from [0-9.]+" | sort | uniq -c | sort -rn | head -n 15
```

Los usuarios que prueban (suele ser `root`, `admin`, `test`...):

```bash
sudo journalctl -u ssh --since "7 days ago" | grep -oE "Invalid user [^ ]+" | sort | uniq -c | sort -rn | head
```

:::tip
Si ves fallos con **usuario `ubuntu`** desde una IP que no es tuya, alguien sabe qué usuario usar,
pero sin la llave privada no puede entrar. fail2ban ya lo está bloqueando ([fail2ban](/deploy/security/fail2ban/)).
:::

## Llaves autorizadas

Las llaves que pueden entrar como `ubuntu`, con su huella:

```bash
ssh-keygen -lf ~/.ssh/authorized_keys
```

Debe haber solo las que reconoces (la del par de AWS y las de los administradores). Para quitar
una, borra su línea:

```bash
nano ~/.ssh/authorized_keys
```

`deploy` todavía **no debe tener ninguna** (el despliegue automático está pendiente):

```bash
sudo ls -la /home/deploy/.ssh/ 2>/dev/null || echo "sin llaves: correcto"
```

`root` tampoco debería tener llaves de uso (y no puede entrar por SSH de todas formas):

```bash
sudo cat /root/.ssh/authorized_keys 2>/dev/null
```

:::caution
Antes de quitar una llave, comprueba que **la tuya** sigue en el archivo y abre una segunda sesión
para confirmarlo antes de cerrar la actual.
:::

## Configuración efectiva de SSH

Lo que SSH aplica de verdad (no lo que dice un archivo):

```bash
sudo sshd -T | grep -E "permitrootlogin|passwordauthentication|kbdinteractive|pubkeyauthentication|allowusers|maxauthtries|x11forwarding|allowagentforwarding"
```

Debe mostrar `permitrootlogin no`, `passwordauthentication no`, `kbdinteractiveauthentication no`,
`pubkeyauthentication yes`, `allowusers ubuntu`, `allowusers deploy`, `maxauthtries 3`,
`x11forwarding no` y `allowagentforwarding no`.

## Usuarios y privilegios

Usuarios con shell (pueden iniciar sesión):

```bash
getent passwd | awk -F: '$7 !~ /(nologin|false)$/ {print $1, $7}'
```

Lo esperado: `root`, `ubuntu`, `deploy` y quizá `sync`. Un usuario nuevo que no creaste es un
incidente.

Quién tiene `sudo` y quién está en el grupo `docker` (que equivale a root):

```bash
getent group sudo docker
```

Lo esperado: `sudo:x:27:ubuntu` y el grupo `docker` **sin miembros**.

## Uso de sudo

Todo lo que se ejecutó con `sudo` hoy:

```bash
sudo journalctl _COMM=sudo --since today | grep COMMAND
```

Útil para reconstruir qué se hizo en el servidor y cuándo.

## Si te quedas fuera

| Causa | Qué hacer |
|---|---|
| fail2ban bloqueó tu IP | Espera 1 hora o conéctate desde otra red (por ejemplo, el celular) y [desbloquéala](/deploy/security/fail2ban/#desbloquear-una-ip) |
| Cambió tu IP y el Security Group solo permite la anterior | Consola de AWS → Security Group → edita la regla del 22 con tu IP nueva |
| Rompiste la configuración de SSH | Detén la instancia, desmonta su volumen, móntalo en una instancia temporal, corrige `/etc/ssh/sshd_config.d/00-hardening.conf` y vuelve a montarlo |
| Perdiste la llave | Igual que el anterior, pero agrega tu llave pública nueva a `/home/ubuntu/.ssh/authorized_keys` |

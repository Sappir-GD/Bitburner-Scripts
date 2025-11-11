
export function get_all_servers(ns){
  const servers = ns.scan()
  let servers_stack = ["home"]

  for (let server of servers) {
		visit(server)
	}

  function visit(passed_target) {
      //add it to the server list
      servers_stack.push(passed_target)

      //get the avaiable targets
      let neighbors = ns.scan(passed_target)

      //check if you visited before
      for (let neighbor of neighbors) {
        if (servers_stack.includes(neighbor) != true) {
          //if not go visit
          visit(neighbor)
        }
      }
  }

  return servers_stack
}

export function get_all_servers_iteratively(ns){
  let visited = []
  let server_list = ["home"]

  //server_list is the stack
  while(server_list.length > 0){
    let current = server_list.pop()
    
    //skip loop once if has visited
    if(visited.includes(current)) continue
    
    //you have visited
    visited.push(current)

    //visit your neighbors and add them too
    let neighbors = ns.scan(current)
    for (let neighbor of neighbors) {
      if (visited.includes(neighbor)){
        server_list.push(neighbor)
      }
    }
  }
  return visited
}

export function install_hacks(ns){
  const servers = get_all_servers(ns)

	for(let server of servers){
		if (ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(server)) {
      const server_data = ns.getServer(server)
			//open stuff
			if (ns.fileExists("BruteSSH.exe", "home") && server_data.brutessh) {
				ns.brutessh(server)
			}
			if (ns.fileExists("FTPCrack.exe", "home") && server_data.ftpcrack) {
				ns.ftpcrack(server)
			}
      if (ns.fileExists("HTTPWorm.exe", "home") && server_data.httpworm) {
				ns.httpworm(server)
			}
      if (ns.fileExists("SQLInject.exe", "home") && server_data.sqlinject) {
				ns.sqlinject(server)
			}

			if (ns.getServerNumPortsRequired(server) <= server_data.openPortCount && server_data.hasAdminRights == false) {
				//access admin
				ns.nuke(server)
				ns.tprint(server + " has been nuked.")
			}

			//server copy file to target
			ns.scp("hack.js", server, "home")
      ns.scp("grow.js", server, "home")
      ns.scp("weaken.js", server, "home")
      ns.tprint("Installed hacks on: ", server)
		}
	}
}

